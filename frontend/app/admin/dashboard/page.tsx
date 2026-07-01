"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../../lib/auth/AuthContext";
import { getDashboardStats, DashboardStats } from "../../../lib/api/admin-dashboard";
import { ApiError } from "../../../lib/api/client";
import { formatPriceCents } from "../../../lib/format";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function AdminDashboardPage() {
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    getDashboardStats(accessToken)
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard."))
      .finally(() => setIsLoading(false));
  }, [accessToken]);

  if (isLoading) {
    return <main className="p-6 text-sm text-zinc-500">Loading dashboard...</main>;
  }

  if (error || !stats) {
    return <main className="p-6 text-sm text-red-600">{error ?? "Failed to load dashboard."}</main>;
  }

  const statusData = Object.entries(stats.orderCountByStatus).map(([status, count]) => ({
    status: STATUS_LABELS[status] ?? status,
    count,
  }));

  const totalOrders = Object.values(stats.orderCountByStatus).reduce((a, b) => a + b, 0);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Total Sales</p>
          <p className="text-2xl font-semibold">{formatPriceCents(stats.totalSalesCents)}</p>
          <p className="text-xs text-zinc-400">Paid orders only (processing/shipped/delivered)</p>
        </div>
        <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">Total Orders</p>
          <p className="text-2xl font-semibold">{totalOrders}</p>
        </div>
      </div>

      <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-medium">Order Count by Status</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#18181b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-medium">Top-Selling Products</h2>
        {stats.topProducts.length === 0 ? (
          <p className="text-sm text-zinc-500">No sales yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2">Product</th>
                <th className="py-2">Units Sold</th>
                <th className="py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {stats.topProducts.map((p) => (
                <tr key={p.productId} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2">{p.totalQuantity}</td>
                  <td className="py-2">{formatPriceCents(p.totalRevenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
