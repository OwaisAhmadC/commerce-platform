"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listProducts, Product, ProductSort } from "../lib/api/products";
import { listCategories, Category } from "../lib/api/categories";
import { ProductCard } from "../components/ProductCard";
import { ProductGrid } from "../components/ProductGrid";
import { ApiError } from "../lib/api/client";
import { getForMe, getTrending } from "../lib/api/recommendations";
import { useAuth } from "../lib/auth/AuthContext";

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

function CatalogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, accessToken } = useAuth();

  const search = searchParams.get("search") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const minPriceCents = searchParams.get("minPriceCents") ?? "";
  const maxPriceCents = searchParams.get("maxPriceCents") ?? "";
  const sort = (searchParams.get("sort") as ProductSort) ?? "newest";
  const page = Number(searchParams.get("page") ?? "1");

  const [searchInput, setSearchInput] = useState(search);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<Product[]>([]);

  const isDefaultView = !search && !categoryId && !minPriceCents && !maxPriceCents && page === 1;

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isDefaultView) return;
    const request = accessToken ? getForMe(accessToken) : getTrending();
    request.then(setRecommended).catch(() => {});
  }, [isDefaultView, accessToken]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    listProducts({
      search: search || undefined,
      categoryId: categoryId || undefined,
      minPriceCents: minPriceCents ? Number(minPriceCents) : undefined,
      maxPriceCents: maxPriceCents ? Number(maxPriceCents) : undefined,
      sort,
      page,
      limit: 12,
    })
      .then((result) => {
        setProducts(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load products.");
      })
      .finally(() => setIsLoading(false));
  }, [search, categoryId, minPriceCents, maxPriceCents, sort, page]);

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    router.push(`/?${params.toString()}`);
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      {isDefaultView && (
        <ProductGrid
          title={user ? "Recommended for you" : "Trending now"}
          products={recommended}
        />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParams({ search: searchInput || undefined });
        }}
        className="flex flex-wrap items-end gap-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="search" className="text-sm font-medium">
            Search
          </label>
          <input
            id="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search products..."
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => updateParams({ categoryId: e.target.value || undefined })}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="minPrice" className="text-sm font-medium">
            Min price ($)
          </label>
          <input
            id="minPrice"
            type="number"
            min={0}
            defaultValue={minPriceCents ? Number(minPriceCents) / 100 : ""}
            onBlur={(e) =>
              updateParams({
                minPriceCents: e.target.value ? String(Math.round(Number(e.target.value) * 100)) : undefined,
              })
            }
            className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="maxPrice" className="text-sm font-medium">
            Max price ($)
          </label>
          <input
            id="maxPrice"
            type="number"
            min={0}
            defaultValue={maxPriceCents ? Number(maxPriceCents) / 100 : ""}
            onBlur={(e) =>
              updateParams({
                maxPriceCents: e.target.value ? String(Math.round(Number(e.target.value) * 100)) : undefined,
              })
            }
            className="w-28 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sort" className="text-sm font-medium">
            Sort by
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Search
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-zinc-500">No products match your filters.</p>
      ) : (
        <>
          <p className="text-sm text-zinc-500">{total} products found</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
              className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-zinc-700"
            >
              Previous
            </button>
            <span className="text-sm text-zinc-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
              className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-zinc-700"
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<main className="p-6">Loading...</main>}>
      <CatalogPage />
    </Suspense>
  );
}
