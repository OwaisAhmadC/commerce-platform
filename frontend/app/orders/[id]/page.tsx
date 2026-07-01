"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../lib/auth/AuthContext";
import { getOrder } from "../../../lib/api/orders";
import { Order } from "../../../lib/api/checkout";
import { ApiError } from "../../../lib/api/client";
import { formatPriceCents } from "../../../lib/format";

const STATUS_LABELS: Record<Order["status"], string> = {
  pending: "Payment pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function OrderDetailPage() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    getOrder(accessToken, params.id)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load order."))
      .finally(() => setIsLoading(false));
  }, [accessToken, params.id]);

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
          to view this order.
        </p>
      </main>
    );
  }

  if (error || !order) {
    return <main className="p-6 text-sm text-red-600">{error ?? "Order not found."}</main>;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <Link href="/orders" className="text-sm text-zinc-500 underline">
        &larr; Back to order history
      </Link>
      <h1 className="text-2xl font-semibold">Order #{order.id.slice(-8)}</h1>
      <p className="text-sm text-zinc-500">
        Placed {new Date(order.createdAt).toLocaleString()}
      </p>
      <p className="text-sm font-medium">{STATUS_LABELS[order.status]}</p>

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
    </main>
  );
}
