"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../lib/auth/AuthContext";
import { CartView, getCart, removeCartItem, updateCartItem } from "../../lib/api/cart";
import { ApiError } from "../../lib/api/client";
import { formatPriceCents } from "../../lib/format";

export default function CartPage() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    getCart(accessToken)
      .then(setCart)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load cart."))
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  async function handleQuantityChange(productId: string, quantity: number) {
    if (!accessToken) return;
    setError(null);
    try {
      const updated = await updateCartItem(accessToken, productId, quantity);
      setCart(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update quantity.");
    }
  }

  async function handleRemove(productId: string) {
    if (!accessToken) return;
    setError(null);
    try {
      const updated = await removeCartItem(accessToken, productId);
      setCart(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove item.");
    }
  }

  if (authLoading || isLoading) {
    return <main className="p-6 text-sm text-zinc-500">Loading cart...</main>;
  }

  if (!user) {
    return (
      <main className="p-6">
        <p className="text-sm">
          <Link href="/login" className="underline">
            Log in
          </Link>{" "}
          to view your cart.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Your Cart</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!cart || cart.items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Your cart is empty.{" "}
          <Link href="/" className="underline">
            Browse products
          </Link>
          .
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {cart.items.map((item) => (
              <li
                key={item.productId}
                className="flex items-center gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800"
              >
                <div className="relative h-20 w-20 flex-shrink-0 bg-zinc-100 dark:bg-zinc-900">
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" unoptimized />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <Link href={`/products/${item.productId}`} className="font-medium underline">
                    {item.name}
                  </Link>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {formatPriceCents(item.priceCents)} each
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={item.stock}
                  value={item.quantity}
                  onChange={(e) => {
                    const value = Math.max(1, Math.min(item.stock, Number(e.target.value) || 1));
                    handleQuantityChange(item.productId, value);
                  }}
                  className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <span className="w-20 text-right text-sm font-medium">
                  {formatPriceCents(item.lineTotalCents)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(item.productId)}
                  className="text-sm text-red-600 underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-lg font-semibold">{formatPriceCents(cart.totalCents)}</span>
          </div>

          <Link
            href="/checkout"
            className="rounded bg-zinc-900 px-4 py-2 text-center text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Proceed to checkout
          </Link>
        </>
      )}
    </main>
  );
}
