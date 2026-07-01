import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Category {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  createdAt?: Date;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
