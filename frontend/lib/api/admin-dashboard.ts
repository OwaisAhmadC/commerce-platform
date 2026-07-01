import { apiRequest } from "./client";
import type { OrderStatus } from "./checkout";

export type TopProduct = {
  productId: string;
  name: string;
  totalQuantity: number;
  totalRevenueCents: number;
};

export type DashboardStats = {
  totalSalesCents: number;
  orderCountByStatus: Record<OrderStatus, number>;
  topProducts: TopProduct[];
};

export function getDashboardStats(token: string) {
  return apiRequest<DashboardStats>("/admin/dashboard", { token });
}
