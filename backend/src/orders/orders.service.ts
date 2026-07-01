import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { PaginatedResult } from '../products/products.service';

// Stock is decremented exactly once, the first time an order enters 'processing'
// (normally via the checkout webhook, but an admin can also move an order there
// manually). Cancelling from a state where stock was already taken restores it.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const STOCK_DECREMENTED_STATUSES: OrderStatus[] = [
  'processing',
  'shipped',
  'delivered',
];

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  findAllForUser(userId: string): Promise<OrderDocument[]> {
    return this.orderModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByIdForUser(
    userId: string,
    orderId: string,
  ): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException('Order not found');
    }
    const order = await this.orderModel
      .findOne({ _id: orderId, userId: new Types.ObjectId(userId) })
      .exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async findAllForAdmin(
    query: ListOrdersQueryDto,
  ): Promise<PaginatedResult<OrderDocument>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filter = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findByIdForAdmin(orderId: string): Promise<OrderDocument> {
    if (!Types.ObjectId.isValid(orderId)) {
      throw new NotFoundException('Order not found');
    }
    const order = await this.orderModel.findById(orderId).exec();
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
  ): Promise<OrderDocument> {
    const order = await this.findByIdForAdmin(orderId);

    if (order.status === newStatus) {
      return order; // idempotent no-op
    }

    if (!ALLOWED_TRANSITIONS[order.status].includes(newStatus)) {
      throw new ConflictException(
        `Cannot move an order from "${order.status}" to "${newStatus}"`,
      );
    }

    const stockAlreadyTaken = STOCK_DECREMENTED_STATUSES.includes(order.status);
    const stockNowTaken = STOCK_DECREMENTED_STATUSES.includes(newStatus);

    if (!stockAlreadyTaken && stockNowTaken) {
      // First time this order takes stock (e.g. admin manually confirms a 'pending' order).
      await this.withTransaction(async (session) => {
        for (const item of order.items) {
          const updated = await this.productModel
            .findOneAndUpdate(
              { _id: item.productId, stock: { $gte: item.quantity } },
              { $inc: { stock: -item.quantity } },
              { session },
            )
            .exec();
          if (!updated) {
            throw new ConflictException(
              `Cannot fulfill order: insufficient stock for "${item.name}"`,
            );
          }
        }
        order.status = newStatus;
        await order.save({ session });
      });
    } else if (stockAlreadyTaken && !stockNowTaken) {
      // Cancelling an order that had already reserved stock -- release it back.
      await this.withTransaction(async (session) => {
        for (const item of order.items) {
          await this.productModel
            .updateOne(
              { _id: item.productId },
              { $inc: { stock: item.quantity } },
              { session },
            )
            .exec();
        }
        order.status = newStatus;
        await order.save({ session });
      });
    } else {
      order.status = newStatus;
      await order.save();
    }

    return order;
  }

  private async withTransaction(
    work: (session: import('mongoose').ClientSession) => Promise<void>,
  ) {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  }
}
