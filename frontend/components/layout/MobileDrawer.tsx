"use client";

import Link from "next/link";
import { ShoppingCart, X } from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import type { Category } from "../../lib/api/categories";

export function MobileDrawer({
  open,
  onClose,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}) {
  const { user, logout } = useAuth();

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300 md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4">
          <Link href="/" onClick={onClose} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <span className="text-lg font-bold text-zinc-900">Cartly</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4 text-sm font-medium text-zinc-700">
          <Link href="/" onClick={onClose} className="rounded-lg px-3 py-2 hover:bg-zinc-50">
            Shop
          </Link>
          <Link href="/" onClick={onClose} className="rounded-lg px-3 py-2 hover:bg-zinc-50">
            Deals
          </Link>
          <Link href="/?sort=newest" onClick={onClose} className="rounded-lg px-3 py-2 hover:bg-zinc-50">
            New Arrivals
          </Link>

          <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Categories
          </p>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/?categoryId=${category.id}`}
              onClick={onClose}
              className="rounded-lg px-3 py-2 hover:bg-zinc-50"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="mt-auto border-t border-zinc-200 p-4">
          {user ? (
            <div className="flex flex-col gap-2">
              <p className="truncate text-sm text-zinc-500">{user.email}</p>
              <Link href="/orders" onClick={onClose} className="text-sm font-medium text-zinc-700">
                My Orders
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/admin/products"
                  onClick={onClose}
                  className="text-sm font-medium text-zinc-700"
                >
                  Admin Panel
                </Link>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="text-left text-sm font-medium text-zinc-700"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Link
                href="/login"
                onClick={onClose}
                className="rounded-full border border-zinc-200 px-4 py-2 text-center text-sm font-medium text-zinc-700"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={onClose}
                className="rounded-full bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
