import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

const PAID_STATUSES: OrderStatus[] = ['processing', 'shipped', 'delivered'];
const DEFAULT_LIMIT = 4;

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  /**
   * "Customers who bought this also bought..." for a specific product, based on
   * co-occurrence in paid orders. Falls back to same-category products when
   * there's no purchase history to draw on yet (e.g. a fresh seed).
   */
  async getRelatedToProduct(productId: string, limit = DEFAULT_LIMIT): Promise<ProductDocument[]> {
    if (!Types.ObjectId.isValid(productId)) return [];
    const productObjectId = new Types.ObjectId(productId);

    const coPurchased = await this.orderModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: { $in: PAID_STATUSES }, 'items.productId': productObjectId } },
      { $unwind: '$items' },
      { $match: { 'items.productId': { $ne: productObjectId } } },
      { $group: { _id: '$items.productId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    if (coPurchased.length > 0) {
      return this.loadProductsPreservingOrder(coPurchased.map((c) => c._id));
    }

    const product = await this.productModel.findById(productId).exec();
    if (!product) return [];

    return this.productModel
      .find({ categoryId: product.categoryId, _id: { $ne: product._id } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Personalized home-page recommendations: the category the customer buys from
   * most, excluding products they already own. Falls back to trending, then to
   * newest, for customers with no purchase history yet.
   */
  async getPersonalizedForUser(userId: string, limit = DEFAULT_LIMIT): Promise<ProductDocument[]> {
    const userOrders = await this.orderModel
      .find({ userId: new Types.ObjectId(userId), status: { $in: PAID_STATUSES } })
      .exec();

    const purchasedIds = new Set<string>();
    for (const order of userOrders) {
      for (const item of order.items) {
        purchasedIds.add(item.productId.toString());
      }
    }

    if (purchasedIds.size === 0) {
      return this.getTrending(limit);
    }

    const purchasedObjectIds = [...purchasedIds].map((id) => new Types.ObjectId(id));
    const purchasedProducts = await this.productModel
      .find({ _id: { $in: purchasedObjectIds } })
      .exec();

    const categoryCounts = new Map<string, number>();
    for (const product of purchasedProducts) {
      const categoryId = product.categoryId.toString();
      categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
    }

    const topCategoryId = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!topCategoryId) {
      return this.getTrending(limit);
    }

    const recommendations = await this.productModel
      .find({
        categoryId: new Types.ObjectId(topCategoryId),
        _id: { $nin: purchasedObjectIds },
      })
      .limit(limit)
      .exec();

    return recommendations.length > 0 ? recommendations : this.getTrending(limit);
  }

  /** Top-selling products overall; falls back to newest when there's no sales data yet. */
  async getTrending(limit = DEFAULT_LIMIT): Promise<ProductDocument[]> {
    const topSelling = await this.orderModel.aggregate<{ _id: Types.ObjectId; totalQuantity: number }>([
      { $match: { status: { $in: PAID_STATUSES } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productId', totalQuantity: { $sum: '$items.quantity' } } },
      { $sort: { totalQuantity: -1 } },
      { $limit: limit },
    ]);

    if (topSelling.length > 0) {
      return this.loadProductsPreservingOrder(topSelling.map((t) => t._id));
    }

    return this.productModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  private async loadProductsPreservingOrder(ids: Types.ObjectId[]): Promise<ProductDocument[]> {
    const products = await this.productModel.find({ _id: { $in: ids } }).exec();
    const productMap = new Map(products.map((p) => [p.id as string, p]));

    const result: ProductDocument[] = [];
    for (const id of ids) {
      const product = productMap.get(id.toString());
      if (product) result.push(product);
    }
    return result;
  }
}
