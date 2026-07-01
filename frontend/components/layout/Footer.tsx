"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Phone, ShoppingCart } from "lucide-react";
import { listCategories, Category } from "../../lib/api/categories";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/" },
  { label: "Cart", href: "/cart" },
  { label: "My Orders", href: "/orders" },
];

// These pages aren't built (out of scope for this UI-only pass) -- kept as inert
// links so the footer's visual layout matches the design exactly.
const SUPPORT_LINKS = ["Help Center", "Shipping & Delivery", "Returns & Refunds", "Contact Us"];

const PAYMENT_BADGES = ["VISA", "Mastercard", "Amex", "PayPal", "Stripe"];

export function Footer() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  return (
    <footer className="mt-auto">
      <div className="bg-indigo-600">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-10 sm:px-6 md:flex-row lg:px-8">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold text-white">Join the Cartly list</h3>
            <p className="mt-1 text-sm text-indigo-100">
              New drops, member deals, and 10% off your first order.
            </p>
          </div>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex w-full max-w-md gap-2"
          >
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full flex-1 rounded-md border-0 px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-white px-5 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              Subscribe
            </button>
          </form>
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <span className="text-lg font-bold text-zinc-900">Cartly</span>
            </Link>
            <p className="mt-3 text-sm text-zinc-500">
              Everyday essentials across electronics, fashion, and home — curated, fairly priced, and
              delivered fast.
            </p>
            <div className="mt-4 flex gap-2">
              {[Mail, Phone, MessageCircle].map((Icon, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label="Contact"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Quick Links</h4>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="hover:text-zinc-900">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Categories</h4>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link href={`/?categoryId=${category.id}`} className="hover:text-zinc-900">
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Support</h4>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              {SUPPORT_LINKS.map((label) => (
                <li key={label}>
                  <span className="cursor-default">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-4 text-xs text-zinc-500 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <span>© {new Date().getFullYear()} Cartly, Inc. All rights reserved.</span>
            <span className="cursor-default">Privacy</span>
            <span className="cursor-default">Terms</span>
          </div>
          <div className="flex items-center gap-2">
            {PAYMENT_BADGES.map((badge) => (
              <span
                key={badge}
                className="rounded border border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-500"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
