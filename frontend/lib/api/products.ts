import { apiRequest } from "./client";

export type Product = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  categoryId: string;
  stock: number;
  createdAt: string;
};

export type ProductSort = "price_asc" | "price_desc" | "newest";

export type ListProductsParams = {
  search?: string;
  categoryId?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: ProductSort;
  page?: number;
  limit?: number;
};

export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function listProducts(params: ListProductsParams = {}) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.categoryId) query.set("categoryId", params.categoryId);
  if (params.minPriceCents !== undefined) query.set("minPriceCents", String(params.minPriceCents));
  if (params.maxPriceCents !== undefined) query.set("maxPriceCents", String(params.maxPriceCents));
  if (params.sort) query.set("sort", params.sort);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return apiRequest<PaginatedResult<Product>>(`/products${qs ? `?${qs}` : ""}`);
}

export function getProduct(id: string) {
  return apiRequest<Product>(`/products/${id}`);
}
