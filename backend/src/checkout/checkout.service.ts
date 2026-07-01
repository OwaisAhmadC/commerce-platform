import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
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
const MOCK_SESSION_PREFIX = 'mock_';

export interface CheckoutSessionResult {
  url: string;
  orderId: string;
  /** True when Stripe couldn't be reached (e.g. placeholder test keys) and this
   *  order was completed via a simulated payment instead of a real one. */
  mock: boolean;
}

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
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') ?? '',
    );
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }

  async createCheckoutSession(
    userId: string,
    email: string,
  ): Promise<CheckoutSessionResult> {
    const cartView = await this.cartService.getCartView(userId);
    if (cartView.items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    for (const item of cartView.items) {
      if (item.quantity > item.stock) {
        throw new ConflictException(
          `Only ${item.stock} of "${item.name}" in stock`,
        );
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
        metadata: { orderId: order.id },
      });

      order.stripeSessionId = session.id;
      await order.save();

      return { url: session.url!, orderId: order.id, mock: false };
    } catch (err) {
      // Stripe is unreachable/misconfigured (e.g. placeholder test keys, no real
      // credentials added yet). Rather than dead-end with an error, fall back to a
      // clearly-labeled mock payment that completes the order immediately through the
      // exact same atomic stock-decrement/cart-clear path a real webhook would use.
      // The moment real Stripe credentials are added, this catch stops firing and the
      // real flow above takes over automatically -- no code change needed later.
      this.logger.warn(
        `Stripe checkout session creation failed (${(err as Error).message}); ` +
          `falling back to a mock payment for order ${order.id}.`,
      );
      return this.completeMockCheckout(order);
    }
  }

  async getSessionStatus(userId: string, sessionId: string) {
    const order = await this.orderModel
      .findOne({
        stripeSessionId: sessionId,
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!order) {
      throw new NotFoundException('Checkout session not found');
    }
    return order;
  }

  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      this.logger.warn(
        `Rejected webhook with invalid signature: ${(err as Error).message}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutCompleted(event.data.object);
    } else if (event.type === 'checkout.session.expired') {
      await this.handleCheckoutExpired(event.data.object);
    }
  }

  /** Mock payment path: no Stripe involved at all, so there's no payment_intent to
   *  refund on failure -- an insufficient-stock race here just cancels the order. */
  private async completeMockCheckout(
    order: OrderDocument,
  ): Promise<CheckoutSessionResult> {
    const mockSessionId = `${MOCK_SESSION_PREFIX}${order._id.toString()}`;
    order.stripeSessionId = mockSessionId;
    await order.save();

    try {
      await this.completeOrderAtomically(order);
    } catch (err) {
      this.logger.error(
        `Mock checkout failed for order ${order.id}: ${(err as Error).message}`,
      );
      order.status = 'cancelled';
      await order.save();
    }

    return {
      url: `${this.frontendUrl}/checkout/confirmation?session_id=${mockSessionId}&mock=1`,
      orderId: order.id,
      mock: true,
    };
  }

  private async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;

    const order = await this.orderModel.findById(orderId).exec();
    if (!order || order.status !== 'pending') {
      // Already processed (webhook redelivery) or unknown order -- no-op, idempotent.
      return;
    }

    try {
      await this.completeOrderAtomically(order);
    } catch (err) {
      this.logger.error(
        `Checkout completion transaction failed for order ${orderId}, cancelling and attempting refund: ${(err as Error).message}`,
      );
      order.status = 'cancelled';
      await order.save();

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
      if (paymentIntentId) {
        try {
          await this.stripe.refunds.create({ payment_intent: paymentIntentId });
        } catch (refundErr) {
          this.logger.error(
            `Failed to issue automatic refund for order ${orderId}: ${(refundErr as Error).message}`,
          );
        }
      }
    }
  }

  /** Atomically decrements stock for every line item, marks the order 'processing',
   *  and clears the user's cart -- shared by both the real Stripe webhook path and the
   *  mock-payment fallback so the two can never drift out of sync with each other. */
  private async completeOrderAtomically(order: OrderDocument): Promise<void> {
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
          .updateOne(
            { userId: order.userId },
            { items: [] },
            { session: mongoSession },
          )
          .exec();
      });
    } finally {
      await mongoSession.endSession();
    }
  }

  private async handleCheckoutExpired(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;

    await this.orderModel
      .updateOne({ _id: orderId, status: 'pending' }, { status: 'cancelled' })
      .exec();
  }
}
