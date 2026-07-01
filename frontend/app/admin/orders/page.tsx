"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../lib/auth/AuthContext";
import { listAllOrders, updateOrderStatus } from "../../../lib/api/admin-orders";
import { Order, OrderStatus } from "../../../lib/api/checkout";
import { ApiError } from "../../../lib/api/client";
import { formatPriceCents } from "../../../lib/format";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export default function AdminOrdersPage() {
  const { accessToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function loadOrders() {
    if (!accessToken) return;
    setIsLoading(true);
    listAllOrders(accessToken, { limit: 100 })
      .then((result) => setOrders(result.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load orders."))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function handleStatusChange(orderId: string, status: OrderStatus) {
    if (!accessToken) return;
    setError(null);
    setUpdatingId(orderId);
    try {
      const updated = await updateOrderStatus(accessToken, orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update order status.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Orders</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2">Order</th>
              <th className="py-2">Date</th>
              <th className="py-2">Total</th>
              <th className="py-2">Status</th>
              <th className="py-2">Update</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const nextOptions = ALLOWED_TRANSITIONS[order.status];
              return (
                <tr key={order.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2">#{order.id.slice(-8)}</td>
                  <td className="py-2">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">{formatPriceCents(order.totalCents)}</td>
                  <td className="py-2 capitalize">{order.status}</td>
                  <td className="py-2">
                    {nextOptions.length === 0 ? (
                      <span className="text-zinc-400">Final</span>
                    ) : (
                      <select
                        disabled={updatingId === order.id}
                        value=""
                        onChange={(e) =>
                          handleStatusChange(order.id, e.target.value as OrderStatus)
                        }
                        className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="" disabled>
                          Move to...
                        </option>
                        {nextOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
