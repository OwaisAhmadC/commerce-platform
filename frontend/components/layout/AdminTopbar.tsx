"use client";

import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";

function initialsFor(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

function sectionTitleFor(pathname: string | null): string {
  if (!pathname) return "Dashboard";
  if (pathname.startsWith("/admin/products")) return "Products";
  if (pathname.startsWith("/admin/orders")) return "Orders";
  if (pathname.startsWith("/admin/dashboard")) return "Dashboard";
  return "Dashboard";
}

export function AdminTopbar({
  onToggleSidebar,
}: {
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuth();
  const section = sectionTitleFor(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <nav className="text-sm text-zinc-500">
          Admin / <span className="font-medium text-zinc-900">{section}</span>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            placeholder="Search orders, products..."
            title="Search (not yet wired to a backend endpoint)"
            className="w-64 rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none"
          />
        </div>
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications (coming soon)"
          className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
        >
          <Bell className="h-5 w-5" />
        </button>
        {user && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
            {initialsFor(user.email)}
          </span>
        )}
      </div>
    </header>
  );
}
