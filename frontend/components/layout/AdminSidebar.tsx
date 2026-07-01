"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  LayoutDashboard,
  ListOrdered,
  Package,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { listAllOrders } from "../../lib/api/admin-orders";

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  disabled?: boolean;
  // Set when this item's href is shared with another nav item (e.g. Analytics reusing
  // Dashboard's route) so it never claims the "active" highlight for that shared path.
  excludeFromActiveState?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Orders", href: "/admin/orders", icon: ListOrdered },
  // Customer management and standalone analytics aren't built (out of scope for this
  // UI-only pass) -- kept visible but inert so the sidebar's layout matches the design.
  { label: "Customers", href: "#", icon: Users, disabled: true },
  {
    label: "Analytics",
    href: "/admin/dashboard",
    icon: BarChart3,
    excludeFromActiveState: true,
  },
];

function initialsFor(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

export function AdminSidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { user, accessToken } = useAuth();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    listAllOrders(accessToken, { status: "pending", limit: 1 })
      .then((result) => setPendingCount(result.total))
      .catch(() => {});
  }, [accessToken]);

  return (
    <aside
      className={`flex h-full flex-col bg-zinc-900 text-zinc-300 transition-all duration-200 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <ShoppingCart className="h-4 w-4" />
        </span>
        {!collapsed && <span className="truncate font-bold text-white">Cartly Admin</span>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname?.startsWith(item.href) && !item.disabled && !item.excludeFromActiveState;
          const Icon = item.icon;
          const badge = item.label === "Orders" ? pendingCount : null;

          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              aria-disabled={item.disabled}
              title={item.disabled ? `${item.label} (coming soon)` : item.label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                item.disabled
                  ? "cursor-not-allowed text-zinc-600"
                  : isActive
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && !!badge && (
                <span className="ml-auto rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-200">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="my-3 border-t border-zinc-800" />

        <Link
          href="#"
          aria-disabled
          title="Settings (coming soon)"
          className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600"
        >
          <Settings className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Back to store</span>}
        </Link>
      </nav>

      {user && (
        <div className="shrink-0 border-t border-zinc-800 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              {initialsFor(user.email)}
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{user.email}</p>
                <p className="text-xs text-zinc-500">Administrator</p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
