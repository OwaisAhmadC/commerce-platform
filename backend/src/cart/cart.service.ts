import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument, CartItem } from './schemas/cart.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { AddCartItemDto } from './dto/add-cart-item.dto';

export interface CartItemView {
  productId: string;
  name: string;
  imageUrl: string;
  priceCents: number;
  quantity: number;
  stock: number;
  lineTotalCents: number;
}

export interface CartView {
  items: CartItemView[];
  totalCents: number;
}

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async getCartView(userId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    return this.buildView(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartView> {
    const product = await this.productModel.findById(dto.productId).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const cart = await this.getOrCreateCart(userId);
    const existing = cart.items.find(
      (item) => item.productId.toString() === dto.productId,
    );
    const newQuantity = (existing?.quantity ?? 0) + dto.quantity;

    if (newQuantity > product.stock) {
      throw new ConflictException(
        `Only ${product.stock} of "${product.name}" in stock`,
      );
    }

    if (existing) {
      existing.quantity = newQuantity;
    } else {
      cart.items.push({
        productId: product._id,
        quantity: dto.quantity,
      });
    }

    await cart.save();
    return this.buildView(cart);
  }

  async updateItem(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<CartView> {
    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (quantity > product.stock) {
      throw new ConflictException(
        `Only ${product.stock} of "${product.name}" in stock`,
      );
    }

    const cart = await this.getOrCreateCart(userId);
    const item = cart.items.find((i) => i.productId.toString() === productId);
    if (!item) {
      throw new NotFoundException('Item not in cart');
    }

    item.quantity = quantity;
    await cart.save();
    return this.buildView(cart);
  }

  async removeItem(userId: string, productId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId,
    );
    await cart.save();
    return this.buildView(cart);
  }

  private async getOrCreateCart(userId: string): Promise<CartDocument> {
    const existing = await this.cartModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (existing) return existing;
    return this.cartModel.create({
      userId: new Types.ObjectId(userId),
      items: [],
    });
  }

  private async buildView(cart: CartDocument): Promise<CartView> {
    const productIds = cart.items.map((item) => item.productId);
    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .exec();
    const productMap = new Map(products.map((p) => [p.id, p]));

    const keptItems: CartItem[] = [];
    const view: CartItemView[] = [];

    for (const item of cart.items) {
      const product = productMap.get(item.productId.toString());
      if (!product) continue;

      keptItems.push(item);
      view.push({
        productId: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        quantity: item.quantity,
        stock: product.stock,
        lineTotalCents: product.priceCents * item.quantity,
      });
    }

    if (keptItems.length !== cart.items.length) {
      cart.items = keptItems;
      await cart.save();
    }

    const totalCents = view.reduce((sum, item) => sum + item.lineTotalCents, 0);
    return { items: view, totalCents };
  }
}
