import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { toJsonTransform } from '../../common/mongoose/to-json-transform';

export type OrderStatus =
  'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  // Snapshot at purchase time — product name/price may change after the order is placed.
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  priceCentsAtPurchase: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({
  timestamps: { createdAt: true, updatedAt: true },
  toJSON: { transform: toJsonTransform },
})
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  })
  status: OrderStatus;

  @Prop({ required: true, min: 0 })
  totalCents: number;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  // Set when the order was created via Stripe Checkout; used by the webhook handler
  // to look up the order and by the frontend confirmation page to poll its status.
  @Prop({ index: true, sparse: true })
  stripeSessionId?: string;

  createdAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
