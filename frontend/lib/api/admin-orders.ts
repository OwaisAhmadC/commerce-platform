import { apiRequest } from "./client";
import type { Order, OrderStatus } from "./checkout";
import type { PaginatedResult } from "./products";

export type ListOrdersParams = {
  status?: OrderStatus;
  page?: number;
  limit?: number;
};

export function listAllOrders(token: string, params: ListOrdersParams = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return apiRequest<PaginatedResult<Order>>(`/orders/admin${qs ? `?${qs}` : ""}`, { token });
}

export function updateOrderStatus(token: string, orderId: string, status: OrderStatus) {
  return apiRequest<Order>(`/orders/admin/${orderId}/status`, {
    method: "PATCH",
    token,
    body: { status },
  });
}
