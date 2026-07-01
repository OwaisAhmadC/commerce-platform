import { apiRequest } from "./client";
import type { Order } from "./checkout";

export function listOrders(token: string) {
  return apiRequest<Order[]>("/orders", { token });
}

export function getOrder(token: string, id: string) {
  return apiRequest<Order>(`/orders/${id}`, { token });
}
