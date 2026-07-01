"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth/AuthContext";
import { listOrders } from "../../lib/api/orders";
import { Order } from "../../lib/api/checkout";
import { ApiError } from "../../lib/api/client";
import { formatPriceCents } from "../../lib/format";

const STATUS_LABELS: Record<Order["status"], string> = {
  pending: "Payment pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function OrdersPage() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    listOrders(accessToken)
      .then(setOrders)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load orders."))
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  if (authLoading || isLoading) {
    return <main className="p-6 text-sm text-zinc-500">Loading orders...</main>;
  }

  if (!user) {
    return (
      <main className="p-6">
        <p className="text-sm">
          <Link href="/login" className="underline">
            Log in
          </Link>{" "}
          to view your orders.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Order History</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {orders.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No orders yet.{" "}
          <Link href="/" className="underline">
            Browse products
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center justify-between rounded border border-zinc-200 p-4 hover:shadow-sm dark:border-zinc-800"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Order #{order.id.slice(-8)}</span>
                  <span className="text-sm text-zinc-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-medium">{STATUS_LABELS[order.status]}</span>
                  <span className="text-sm text-zinc-500">{formatPriceCents(order.totalCents)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
