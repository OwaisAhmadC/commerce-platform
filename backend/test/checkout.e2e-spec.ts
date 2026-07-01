import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import Stripe from 'stripe';
import { AppModule } from '../src/app.module';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import { Category, CategoryDocument } from '../src/categories/schemas/category.schema';
import { Product, ProductDocument } from '../src/products/schemas/product.schema';
import { Cart, CartDocument } from '../src/cart/schemas/cart.schema';
import { Order, OrderDocument } from '../src/orders/schemas/order.schema';

/**
 * Exercises the Stripe webhook -> atomic transaction path (stock decrement +
 * order status update + cart clear) without needing real Stripe network access.
 * Signature verification is pure local HMAC, so we can sign a fake event with
 * the same webhook secret the app is configured with and post it directly.
 */
describe('Checkout webhook (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<UserDocument>;
  let categoryModel: Model<CategoryDocument>;
  let productModel: Model<ProductDocument>;
  let cartModel: Model<CartDocument>;
  let orderModel: Model<OrderDocument>;
  let webhookSecret: string;
  let stripeForSigning: Stripe;

  let userId: string;
  let categoryId: Types.ObjectId;
  const testEmail = `checkout-webhook-test-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    await app.init();

    userModel = moduleFixture.get(getModelToken(User.name));
    categoryModel = moduleFixture.get(getModelToken(Category.name));
    productModel = moduleFixture.get(getModelToken(Product.name));
    cartModel = moduleFixture.get(getModelToken(Cart.name));
    orderModel = moduleFixture.get(getModelToken(Order.name));

    const configService = moduleFixture.get(ConfigService);
    webhookSecret = configService.get<string>('STRIPE_WEBHOOK_SECRET')!;
    stripeForSigning = new Stripe('sk_test_signing_only_no_network_call');

    const user = await userModel.create({
      email: testEmail,
      passwordHash: 'not-used-in-this-test',
      role: 'customer',
    });
    userId = user.id as string;

    const category = await categoryModel.create({ name: `Webhook Test Category ${Date.now()}` });
    categoryId = category._id;
  });

  afterAll(async () => {
    await orderModel.deleteMany({ userId: new Types.ObjectId(userId) });
    await cartModel.deleteMany({ userId: new Types.ObjectId(userId) });
    await productModel.deleteMany({ name: /^Webhook Test Product/ });
    await categoryModel.deleteMany({ name: /^Webhook Test Category/ });
    await userModel.deleteOne({ _id: userId });
    await app.close();
  });

  async function postSignedWebhook(payload: object) {
    const body = JSON.stringify(payload);
    const signature = stripeForSigning.webhooks.generateTestHeaderString({
      payload: body,
      secret: webhookSecret,
    });

    return request(app.getHttpServer())
      .post('/api/checkout/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(body);
  }

  function completedEventPayload(sessionId: string, orderId: string, paymentIntent = 'pi_fake') {
    return {
      id: `evt_${sessionId}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          metadata: { orderId },
          payment_intent: paymentIntent,
        },
      },
    };
  }

  function expiredEventPayload(sessionId: string, orderId: string) {
    return {
      id: `evt_${sessionId}_expired`,
      object: 'event',
      type: 'checkout.session.expired',
      data: {
        object: { id: sessionId, object: 'checkout.session', metadata: { orderId } },
      },
    };
  }

  it('rejects a webhook with an invalid signature', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/checkout/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=deadbeef')
      .send(JSON.stringify({ type: 'checkout.session.completed' }));

    expect(res.status).toBe(400);
  });

  it('completes an order atomically: decrements stock and clears the cart', async () => {
    const product = await productModel.create({
      name: 'Webhook Test Product A',
      description: 'test',
      priceCents: 1000,
      imageUrl: 'https://example.com/a.png',
      categoryId,
      stock: 5,
    });

    await cartModel.create({
      userId: new Types.ObjectId(userId),
      items: [{ productId: product._id, quantity: 2 }],
    });

    const order = await orderModel.create({
      userId: new Types.ObjectId(userId),
      status: 'pending',
      totalCents: 2000,
      items: [
        { productId: product._id, name: product.name, quantity: 2, priceCentsAtPurchase: 1000 },
      ],
      stripeSessionId: 'cs_test_complete_1',
    });

    const res = await postSignedWebhook(
      completedEventPayload('cs_test_complete_1', order.id as string),
    );
    expect(res.status).toBe(200);

    const updatedOrder = await orderModel.findById(order._id).exec();
    expect(updatedOrder?.status).toBe('processing');

    const updatedProduct = await productModel.findById(product._id).exec();
    expect(updatedProduct?.stock).toBe(3);

    const updatedCart = await cartModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
    expect(updatedCart?.items).toHaveLength(0);
  });

  it('is idempotent when the same completed webhook is delivered twice', async () => {
    const product = await productModel.create({
      name: 'Webhook Test Product B',
      description: 'test',
      priceCents: 500,
      imageUrl: 'https://example.com/b.png',
      categoryId,
      stock: 5,
    });

    const order = await orderModel.create({
      userId: new Types.ObjectId(userId),
      status: 'pending',
      totalCents: 500,
      items: [
        { productId: product._id, name: product.name, quantity: 1, priceCentsAtPurchase: 500 },
      ],
      stripeSessionId: 'cs_test_idempotent',
    });

    const payload = completedEventPayload('cs_test_idempotent', order.id as string);
    const first = await postSignedWebhook(payload);
    const second = await postSignedWebhook(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const updatedProduct = await productModel.findById(product._id).exec();
    expect(updatedProduct?.stock).toBe(4); // decremented once, not twice
  });

  it('cancels the order and leaves stock untouched when stock is insufficient at completion time', async () => {
    const product = await productModel.create({
      name: 'Webhook Test Product C',
      description: 'test',
      priceCents: 500,
      imageUrl: 'https://example.com/c.png',
      categoryId,
      stock: 1, // only 1 left, but the order below wants 3
    });

    const order = await orderModel.create({
      userId: new Types.ObjectId(userId),
      status: 'pending',
      totalCents: 1500,
      items: [
        { productId: product._id, name: product.name, quantity: 3, priceCentsAtPurchase: 500 },
      ],
      stripeSessionId: 'cs_test_insufficient_stock',
    });

    const res = await postSignedWebhook(
      completedEventPayload('cs_test_insufficient_stock', order.id as string),
    );
    expect(res.status).toBe(200);

    const updatedOrder = await orderModel.findById(order._id).exec();
    expect(updatedOrder?.status).toBe('cancelled');

    const updatedProduct = await productModel.findById(product._id).exec();
    expect(updatedProduct?.stock).toBe(1); // untouched, not decremented below zero
  });

  it('cancels a pending order when the checkout session expires', async () => {
    const product = await productModel.create({
      name: 'Webhook Test Product D',
      description: 'test',
      priceCents: 500,
      imageUrl: 'https://example.com/d.png',
      categoryId,
      stock: 5,
    });

    const order = await orderModel.create({
      userId: new Types.ObjectId(userId),
      status: 'pending',
      totalCents: 500,
      items: [
        { productId: product._id, name: product.name, quantity: 1, priceCentsAtPurchase: 500 },
      ],
      stripeSessionId: 'cs_test_expired',
    });

    const res = await postSignedWebhook(expiredEventPayload('cs_test_expired', order.id as string));
    expect(res.status).toBe(200);

    const updatedOrder = await orderModel.findById(order._id).exec();
    expect(updatedOrder?.status).toBe('cancelled');
  });
});
