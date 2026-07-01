import { apiRequest } from "./client";
import type { Product } from "./products";

export function getRelatedProducts(productId: string, limit = 4) {
  return apiRequest<Product[]>(`/recommendations/products/${productId}?limit=${limit}`);
}

export function getTrending(limit = 4) {
  return apiRequest<Product[]>(`/recommendations/trending?limit=${limit}`);
}

export function getForMe(token: string, limit = 4) {
  return apiRequest<Product[]>(`/recommendations/for-me?limit=${limit}`, { token });
}
