"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../lib/auth/AuthContext";
import { getCheckoutSessionStatus, Order } from "../../../lib/api/checkout";
import { ApiError } from "../../../lib/api/client";
import { formatPriceCents } from "../../../lib/format";

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 10;

function ConfirmationPage() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!accessToken || !sessionId) return;

    let cancelled = false;

    async function poll() {
      try {
        const result = await getCheckoutSessionStatus(accessToken!, sessionId!);
        if (cancelled) return;
        setOrder(result);
        if (result.status === "pending" && pollCount < MAX_POLLS) {
          setTimeout(() => setPollCount((c) => c + 1), POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load order status.");
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, sessionId, pollCount]);

  if (authLoading) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  if (!sessionId) {
    return <main className="p-6 text-sm text-red-600">No checkout session specified.</main>;
  }

  if (error) {
    return <main className="p-6 text-sm text-red-600">{error}</main>;
  }

  if (!order) {
    return <main className="p-6 text-sm text-zinc-500">Loading order...</main>;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      {order.status === "pending" ? (
        <>
          <h1 className="text-2xl font-semibold">Processing your payment...</h1>
          <p className="text-sm text-zinc-500">This usually only takes a moment.</p>
        </>
      ) : order.status === "cancelled" ? (
        <>
          <h1 className="text-2xl font-semibold text-red-600">Order could not be completed</h1>
          <p className="text-sm text-zinc-500">
            Your payment could not be fulfilled (e.g. an item sold out). Any charge has been
            refunded. Please check your cart and try again.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-green-700 dark:text-green-500">
            Order confirmed!
          </h1>
          <p className="text-sm text-zinc-500">Order #{order.id}</p>
        </>
      )}

      <ul className="flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        {order.items.map((item) => (
          <li key={item.productId} className="flex justify-between text-sm">
            <span>
              {item.name} &times; {item.quantity}
            </span>
            <span>{formatPriceCents(item.priceCentsAtPurchase * item.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="flex justify-between text-lg font-semibold">
        <span>Total</span>
        <span>{formatPriceCents(order.totalCents)}</span>
      </div>

      <div className="flex gap-4 text-sm">
        <Link href="/" className="underline">
          Continue shopping
        </Link>
        <Link href="/orders" className="underline">
          View order history
        </Link>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<main className="p-6">Loading...</main>}>
      <ConfirmationPage />
    </Suspense>
  );
}
