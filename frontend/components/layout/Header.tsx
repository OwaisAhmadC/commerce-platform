"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Heart, Menu, Search, ShoppingCart } from "lucide-react";
import { useAuth } from "../../lib/auth/AuthContext";
import { listCategories, Category } from "../../lib/api/categories";
import { getCart } from "../../lib/api/cart";
import { MobileDrawer } from "./MobileDrawer";

const NAV_LINKS = [
  { label: "Shop", href: "/" },
  { label: "Deals", href: "/" },
  { label: "New Arrivals", href: "/?sort=newest" },
];

function initialsFor(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
}

export function Header() {
  const { user, accessToken, logout, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const categoriesRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  // Cart badge reflects existing cart state -- re-fetched (not re-architected) whenever
  // the user logs in/out or navigates, since add/update/remove already happen elsewhere.
  useEffect(() => {
    if (!accessToken) {
      setCartCount(0);
      return;
    }
    getCart(accessToken)
      .then((cart) => setCartCount(cart.items.reduce((sum, item) => sum + item.quantity, 0)))
      .catch(() => {});
  }, [accessToken, pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoriesRef.current && !categoriesRef.current.contains(e.target as Node)) {
        setCategoriesOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchValue) params.set("search", searchValue);
    router.push(`/?${params.toString()}`);
  }

  const initials = user ? initialsFor(user.email) : "";

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <span className="text-lg font-bold text-zinc-900">Cartly</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-700 md:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="hover:text-zinc-950">
                {link.label}
              </Link>
            ))}
            <div className="relative" ref={categoriesRef}>
              <button
                type="button"
                onClick={() => setCategoriesOpen((v) => !v)}
                className="flex items-center gap-1 hover:text-zinc-950"
              >
                Categories
                <ChevronDown className="h-4 w-4" />
              </button>
              {categoriesOpen && (
                <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border border-zinc-200 bg-white py-2 shadow-lg">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/?categoryId=${category.id}`}
                      onClick={() => setCategoriesOpen(false)}
                      className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <form onSubmit={handleSearchSubmit} className="mx-4 hidden max-w-md flex-1 md:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                type="search"
                placeholder="Search products, brands and categories"
                className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-4">
            <button
              type="button"
              aria-label="Wishlist"
              title="Wishlist (coming soon)"
              className="hidden h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 sm:inline-flex"
            >
              <Heart className="h-5 w-5" />
            </button>

            <Link
              href="/cart"
              aria-label="Cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">
                  {cartCount}
                </span>
              )}
            </Link>

            {isLoading ? null : user ? (
              <div className="relative" ref={avatarRef}>
                <button
                  type="button"
                  onClick={() => setAvatarOpen((v) => !v)}
                  className="flex items-center gap-1"
                  aria-label="Account menu"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                    {initials}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-zinc-500 sm:block" />
                </button>
                {avatarOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-zinc-200 bg-white py-2 shadow-lg">
                    <div className="border-b border-zinc-100 px-4 py-2 text-xs text-zinc-500">
                      {user.email}
                    </div>
                    <Link
                      href="/orders"
                      onClick={() => setAvatarOpen(false)}
                      className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      My Orders
                    </Link>
                    {user.role === "admin" && (
                      <Link
                        href="/admin/products"
                        onClick={() => setAvatarOpen(false)}
                        className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                      >
                        Admin Panel
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarOpen(false);
                        logout();
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-3 text-sm font-medium sm:flex">
                <Link href="/login" className="text-zinc-700 hover:text-zinc-950">
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-indigo-600 px-4 py-1.5 text-white hover:bg-indigo-700"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="pb-3 md:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              type="search"
              placeholder="Search Cartly"
              className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none"
            />
          </div>
        </form>

        <div className="flex gap-2 overflow-x-auto pb-3 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/?categoryId=${category.id}`}
              className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 font-medium text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </div>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categories={categories}
      />
    </header>
  );
}
