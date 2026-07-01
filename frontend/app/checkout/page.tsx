"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth/AuthContext";
import { getCart, CartView } from "../../lib/api/cart";
import { createCheckoutSession } from "../../lib/api/checkout";
import { ApiError } from "../../lib/api/client";
import { formatPriceCents } from "../../lib/format";

export default function CheckoutPage() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  async function handlePay() {
    if (!accessToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const session = await createCheckoutSession(accessToken);
      if (session.url) {
        window.location.href = session.url;
      } else {
        setError("Payment provider did not return a checkout URL.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start checkout.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || isLoading) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  if (!user) {
    return (
      <main className="p-6">
        <p className="text-sm">
          <Link href="/login" className="underline">
            Log in
          </Link>{" "}
          to check out.
        </p>
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="p-6">
        <p className="text-sm text-zinc-500">
          Your cart is empty.{" "}
          <Link href="/" className="underline">
            Browse products
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Checkout</h1>

      <ul className="flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        {cart.items.map((item) => (
          <li key={item.productId} className="flex justify-between text-sm">
            <span>
              {item.name} &times; {item.quantity}
            </span>
            <span>{formatPriceCents(item.lineTotalCents)}</span>
          </li>
        ))}
      </ul>

      <div className="flex justify-between text-lg font-semibold">
        <span>Total</span>
        <span>{formatPriceCents(cart.totalCents)}</span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handlePay}
        disabled={isSubmitting}
        className="rounded bg-zinc-900 px-4 py-3 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {isSubmitting ? "Redirecting to payment..." : "Pay with card (Stripe test mode)"}
      </button>
    </main>
  );
}
