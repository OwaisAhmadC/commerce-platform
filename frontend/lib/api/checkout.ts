import { apiRequest } from "./client";

export type CheckoutSessionResponse = {
  url: string | null;
  orderId: string;
  /** True when Stripe wasn't reachable/configured and this order was completed via a
   *  simulated payment instead of a real Stripe charge. */
  mock: boolean;
};

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

export type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  priceCentsAtPurchase: number;
};

export type Order = {
  id: string;
  userId: string;
  status: OrderStatus;
  totalCents: number;
  items: OrderItem[];
  stripeSessionId?: string;
  createdAt: string;
};

export function createCheckoutSession(token: string) {
  return apiRequest<CheckoutSessionResponse>("/checkout/session", { method: "POST", token });
}

export function getCheckoutSessionStatus(token: string, sessionId: string) {
  return apiRequest<Order>(`/checkout/session/${sessionId}`, { token });
}
