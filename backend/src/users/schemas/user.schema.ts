import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Document } from 'mongoose';
import { toJsonTransform } from '../../common/mongoose/to-json-transform';

export type UserRole = 'customer' | 'admin';

export type UserDocument = HydratedDocument<User>;

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: {
    transform: (doc: Document, ret: Record<string, unknown>) => {
      const transformed = toJsonTransform(doc, ret);
      delete transformed.passwordHash;
      return transformed;
    },
  },
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: ['customer', 'admin'], default: 'customer' })
  role: UserRole;

  createdAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
