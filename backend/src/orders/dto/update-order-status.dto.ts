import { IsIn } from 'class-validator';
import type { OrderStatus } from '../schemas/order.schema';

const STATUSES: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export class UpdateOrderStatusDto {
  @IsIn(STATUSES)
  status: OrderStatus;
}
