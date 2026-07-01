import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { toJsonTransform } from '../../common/mongoose/to-json-transform';

export type ProductDocument = HydratedDocument<Product>;

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: { transform: toJsonTransform },
})
export class Product {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true, min: 0 })
  priceCents: number;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, min: 0, default: 0 })
  stock: number;

  createdAt?: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ name: 'text' });
ProductSchema.index({ priceCents: 1 });
