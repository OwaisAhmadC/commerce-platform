import { apiRequest } from "./client";

export type CartItemView = {
  productId: string;
  name: string;
  imageUrl: string;
  priceCents: number;
  quantity: number;
  stock: number;
  lineTotalCents: number;
};

export type CartView = {
  items: CartItemView[];
  totalCents: number;
};

export function getCart(token: string) {
  return apiRequest<CartView>("/cart", { token });
}

export function addCartItem(token: string, productId: string, quantity: number) {
  return apiRequest<CartView>("/cart/items", {
    method: "POST",
    token,
    body: { productId, quantity },
  });
}

export function updateCartItem(token: string, productId: string, quantity: number) {
  return apiRequest<CartView>(`/cart/items/${productId}`, {
    method: "PATCH",
    token,
    body: { quantity },
  });
}

export function removeCartItem(token: string, productId: string) {
  return apiRequest<CartView>(`/cart/items/${productId}`, {
    method: "DELETE",
    token,
  });
}
