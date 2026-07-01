import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';

// "Sales" = orders that were actually paid for. Pending orders haven't completed
// payment yet and cancelled orders never did, so neither counts toward revenue.
const PAID_STATUSES: OrderStatus[] = ['processing', 'shipped', 'delivered'];
const ALL_STATUSES: OrderStatus[] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

export interface TopProduct {
  productId: string;
  name: string;
  totalQuantity: number;
  totalRevenueCents: number;
}

export interface DashboardStats {
  totalSalesCents: number;
  orderCountByStatus: Record<OrderStatus, number>;
  topProducts: TopProduct[];
}

interface FacetResult {
  totalSales: Array<{ total: number }>;
  countByStatus: Array<{ _id: OrderStatus; count: number }>;
  topProducts: Array<{
    _id: unknown;
    name: string;
    totalQuantity: number;
    totalRevenueCents: number;
  }>;
}

@Injectable()
export class AdminService {
  constructor(@InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>) {}

  async getDashboardStats(): Promise<DashboardStats> {
    const [result] = await this.orderModel.aggregate<FacetResult>([
      {
        $facet: {
          totalSales: [
            { $match: { status: { $in: PAID_STATUSES } } },
            { $group: { _id: null, total: { $sum: '$totalCents' } } },
          ],
          countByStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          topProducts: [
            { $match: { status: { $in: PAID_STATUSES } } },
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.productId',
                name: { $first: '$items.name' },
                totalQuantity: { $sum: '$items.quantity' },
                totalRevenueCents: {
                  $sum: { $multiply: ['$items.priceCentsAtPurchase', '$items.quantity'] },
                },
              },
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 },
          ],
        },
      },
    ]);

    const orderCountByStatus = ALL_STATUSES.reduce(
      (acc, status) => ({ ...acc, [status]: 0 }),
      {} as Record<OrderStatus, number>,
    );
    for (const entry of result.countByStatus) {
      orderCountByStatus[entry._id] = entry.count;
    }

    return {
      totalSalesCents: result.totalSales[0]?.total ?? 0,
      orderCountByStatus,
      topProducts: result.topProducts.map((p) => ({
        productId: String(p._id),
        name: p.name,
        totalQuantity: p.totalQuantity,
        totalRevenueCents: p.totalRevenueCents,
      })),
    };
  }
}
