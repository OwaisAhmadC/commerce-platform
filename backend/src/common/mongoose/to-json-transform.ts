import { Document } from 'mongoose';

/**
 * Shared toJSON transform: expose Mongo's `_id` as `id` and drop internal
 * `_id`/`__v` fields so the API contract doesn't leak Mongoose internals.
 */
export function toJsonTransform(_doc: Document, ret: Record<string, unknown>) {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
}
