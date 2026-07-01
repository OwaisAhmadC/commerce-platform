import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { CartService } from '../cart/cart.service';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

const SESSION_EXPIRY_SECONDS = 30 * 60;

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly stripe: Stripe;
  private readonly frontendUrl: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly cartService: CartService,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY') ?? '');
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }

  async createCheckoutSession(userId: string, email: string) {
    const cartView = await this.cartService.getCartView(userId);
    if (cartView.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    for (const item of cartView.items) {
      if (item.quantity > item.stock) {
        throw new ConflictException(`Only ${item.stock} of "${item.name}" in stock`);
      }
    }

    const order = await this.orderModel.create({
      userId: new Types.ObjectId(userId),
      status: 'pending',
      totalCents: cartView.totalCents,
      items: cartView.items.map((item) => ({
        productId: new Types.ObjectId(item.productId),
        name: item.name,
        quantity: item.quantity,
        priceCentsAtPurchase: item.priceCents,
      })),
    });

    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: order.items.map((item) => ({
          price_data: {
            currency: 'usd',
            product_data: { name: item.name },
            unit_amount: item.priceCentsAtPurchase,
          },
          quantity: item.quantity,
        })),
        customer_email: email,
        success_url: `${this.frontendUrl}/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.frontendUrl}/cart`,
        expires_at: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS,
        metadata: { orderId: order.id as string },
      });

      order.stripeSessionId = session.id;
      await order.save();

      return { url: session.url, orderId: order.id as string };
    } catch (err) {
      // Roll back the pending order rather than leaving an orphaned record if Stripe
      // is unreachable or misconfigured (e.g. a placeholder key before real credentials
      // are added) -- surface a clean error instead of a raw Stripe/network stack trace.
      await this.orderModel.deleteOne({ _id: order._id }).exec();
      this.logger.error(`Failed to create Stripe checkout session: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'Payment provider is currently unavailable. Please try again later.',
      );
    }
  }

  async getSessionStatus(userId: string, sessionId: string) {
    const order = await this.orderModel
      .findOne({ stripeSessionId: sessionId, userId: new Types.ObjectId(userId) })
      .exec();
    if (!order) {
      throw new NotFoundException('Checkout session not found');
    }
    return order;
  }

  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (err) {
      this.logger.warn(`Rejected webhook with invalid signature: ${(err as Error).message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === 'checkout.session.expired') {
      await this.handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;

    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.status !== 'pending') {
      // Already processed (webhook redelivery) or unknown order -- no-op, idempotent.
      return;
    }

    const mongoSession = await this.connection.startSession();
    try {
      await mongoSession.withTransaction(async () => {
        for (const item of order.items) {
          const updated = await this.productModel
            .findOneAndUpdate(
              { _id: item.productId, stock: { $gte: item.quantity } },
              { $inc: { stock: -item.quantity } },
              { session: mongoSession },
            )
            .exec();
          if (!updated) {
            throw new Error(
              `Insufficient stock for product ${item.productId.toString()} during checkout completion`,
            );
          }
        }

        order.status = 'processing';
        await order.save({ session: mongoSession });

        await this.cartModel
          .updateOne({ userId: order.userId }, { items: [] }, { session: mongoSession })
          .exec();
      });
    } catch (err) {
      this.logger.error(
        `Checkout completion transaction failed for order ${orderId}, cancelling and attempting refund: ${(err as Error).message}`,
      );
      order.status = 'cancelled';
      await order.save();

      const paymentIntentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      if (paymentIntentId) {
        try {
          await this.stripe.refunds.create({ payment_intent: paymentIntentId });
        } catch (refundErr) {
          this.logger.error(
            `Failed to issue automatic refund for order ${orderId}: ${(refundErr as Error).message}`,
          );
        }
      }
    } finally {
      await mongoSession.endSession();
    }
  }

  private async handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;

    await this.orderModel
      .updateOne({ _id: orderId, status: 'pending' }, { status: 'cancelled' })
      .exec();
  }
}
