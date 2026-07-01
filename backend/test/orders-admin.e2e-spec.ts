import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import {
  Category,
  CategoryDocument,
} from '../src/categories/schemas/category.schema';
import {
  Product,
  ProductDocument,
} from '../src/products/schemas/product.schema';
import { Order, OrderDocument } from '../src/orders/schemas/order.schema';

interface LoginResponseBody {
  accessToken: string;
}

interface ErrorResponseBody {
  message: string;
}

/**
 * Verifies the order status lifecycle: only allowed transitions succeed, and
 * stock is decremented/restored at exactly the right points (not double-counted).
 */
describe('Admin order status transitions (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<UserDocument>;
  let categoryModel: Model<CategoryDocument>;
  let productModel: Model<ProductDocument>;
  let orderModel: Model<OrderDocument>;

  let adminToken: string;
  let customerToken: string;
  const adminEmail = `orders-admin-e2e-${Date.now()}@example.com`;
  const customerEmail = `orders-customer-e2e-${Date.now()}@example.com`;
  let adminUserId: string;
  let customerUserId: string;
  let categoryId: Types.ObjectId;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    userModel = moduleFixture.get(getModelToken(User.name));
    categoryModel = moduleFixture.get(getModelToken(Category.name));
    productModel = moduleFixture.get(getModelToken(Product.name));
    orderModel = moduleFixture.get(getModelToken(Order.name));

    const passwordHash = await bcrypt.hash('password123', 10);
    const admin = await userModel.create({
      email: adminEmail,
      passwordHash,
      role: 'admin',
    });
    const customer = await userModel.create({
      email: customerEmail,
      passwordHash,
      role: 'customer',
    });
    adminUserId = admin.id;
    customerUserId = customer.id;

    const category = await categoryModel.create({
      name: `Orders Admin Test Category ${Date.now()}`,
    });
    categoryId = category._id;

    const adminLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'password123' });
    adminToken = (adminLogin.body as LoginResponseBody).accessToken;

    const customerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerEmail, password: 'password123' });
    customerToken = (customerLogin.body as LoginResponseBody).accessToken;
  });

  afterAll(async () => {
    await orderModel.deleteMany({ userId: new Types.ObjectId(customerUserId) });
    await productModel.deleteMany({ name: /^Orders Admin Test Product/ });
    await categoryModel.deleteOne({ _id: categoryId });
    await userModel.deleteMany({ _id: { $in: [adminUserId, customerUserId] } });
    await app.close();
  });

  async function createPendingOrder(productStock: number, quantity: number) {
    const product = await productModel.create({
      name: `Orders Admin Test Product ${Date.now()}-${Math.random()}`,
      description: 'test',
      priceCents: 500,
      imageUrl: 'https://example.com/x.png',
      categoryId,
      stock: productStock,
    });
    const order = await orderModel.create({
      userId: new Types.ObjectId(customerUserId),
      status: 'pending',
      totalCents: 500 * quantity,
      items: [
        {
          productId: product._id,
          name: product.name,
          quantity,
          priceCentsAtPurchase: 500,
        },
      ],
    });
    return { product, order };
  }

  it('rejects a non-admin updating order status', async () => {
    const { order } = await createPendingOrder(5, 1);
    await request(app.getHttpServer())
      .patch(`/api/orders/admin/${order.id}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'processing' })
      .expect(403);
  });

  it('rejects an invalid transition (pending -> delivered)', async () => {
    const { order } = await createPendingOrder(5, 1);
    const res = await request(app.getHttpServer())
      .patch(`/api/orders/admin/${order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'delivered' })
      .expect(409);
    expect((res.body as ErrorResponseBody).message).toContain('Cannot move');
  });

  it('decrements stock exactly once when an order first enters processing', async () => {
    const { product, order } = await createPendingOrder(5, 2);

    await request(app.getHttpServer())
      .patch(`/api/orders/admin/${order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' })
      .expect(200);

    const updatedProduct = await productModel.findById(product._id).exec();
    expect(updatedProduct?.stock).toBe(3); // 5 - 2

    // Further lifecycle transitions must not touch stock again.
    await request(app.getHttpServer())
      .patch(`/api/orders/admin/${order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'shipped' })
      .expect(200);

    const afterShipped = await productModel.findById(product._id).exec();
    expect(afterShipped?.stock).toBe(3);
  });

  it('rejects moving to processing when stock is insufficient', async () => {
    const { order } = await createPendingOrder(1, 3); // wants 3, only 1 in stock

    const res = await request(app.getHttpServer())
      .patch(`/api/orders/admin/${order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' })
      .expect(409);
    expect((res.body as ErrorResponseBody).message).toContain(
      'insufficient stock',
    );

    const updatedOrder = await orderModel.findById(order._id).exec();
    expect(updatedOrder?.status).toBe('pending'); // unchanged
  });

  it('restores stock when an order already in processing is cancelled', async () => {
    const { product, order } = await createPendingOrder(5, 2);

    await request(app.getHttpServer())
      .patch(`/api/orders/admin/${order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' })
      .expect(200);

    let updatedProduct = await productModel.findById(product._id).exec();
    expect(updatedProduct?.stock).toBe(3);

    await request(app.getHttpServer())
      .patch(`/api/orders/admin/${order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })
      .expect(200);

    updatedProduct = await productModel.findById(product._id).exec();
    expect(updatedProduct?.stock).toBe(5); // fully restored
  });

  it('does not restore stock when a still-pending order is cancelled (none was taken)', async () => {
    const { product, order } = await createPendingOrder(5, 2);

    await request(app.getHttpServer())
      .patch(`/api/orders/admin/${order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'cancelled' })
      .expect(200);

    const updatedProduct = await productModel.findById(product._id).exec();
    expect(updatedProduct?.stock).toBe(5); // never decremented, so nothing to restore
  });

  it('treats a same-status update as a no-op rather than an error', async () => {
    const { order } = await createPendingOrder(5, 1);
    await request(app.getHttpServer())
      .patch(`/api/orders/admin/${order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'pending' })
      .expect(200);
  });
});
