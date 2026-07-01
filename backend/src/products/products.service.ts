import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  async findAll(query: ListProductsQueryDto): Promise<PaginatedResult<ProductDocument>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: QueryFilter<ProductDocument> = {};

    if (query.search) {
      filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
    }

    if (query.categoryId) {
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }

    if (query.minPriceCents !== undefined || query.maxPriceCents !== undefined) {
      filter.priceCents = {};
      if (query.minPriceCents !== undefined) filter.priceCents.$gte = query.minPriceCents;
      if (query.maxPriceCents !== undefined) filter.priceCents.$lte = query.maxPriceCents;
    }

    const sort: Record<string, 1 | -1> =
      query.sort === 'price_asc'
        ? { priceCents: 1 }
        : query.sort === 'price_desc'
          ? { priceCents: -1 }
          : { createdAt: -1 };

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async findById(id: string): Promise<ProductDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Product not found');
    }
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
