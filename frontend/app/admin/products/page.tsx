"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth/AuthContext";
import { listProducts, deleteProduct, Product } from "../../../lib/api/products";
import { ApiError } from "../../../lib/api/client";
import { formatPriceCents } from "../../../lib/format";

export default function AdminProductsPage() {
  const { accessToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function loadProducts() {
    setIsLoading(true);
    listProducts({ limit: 100 })
      .then((result) => setProducts(result.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load products."))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleDelete(id: string) {
    if (!accessToken) return;
    if (!confirm("Delete this product? This cannot be undone.")) return;
    setError(null);
    try {
      await deleteProduct(accessToken, id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete product.");
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link
          href="/admin/products/new"
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New product
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-zinc-500">Loading...</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2">Name</th>
              <th className="py-2">Price</th>
              <th className="py-2">Stock</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-zinc-100 dark:border-zinc-900">
                <td className="py-2">{product.name}</td>
                <td className="py-2">{formatPriceCents(product.priceCents)}</td>
                <td className="py-2">{product.stock}</td>
                <td className="flex gap-3 py-2">
                  <Link href={`/admin/products/${product.id}/edit`} className="underline">
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(product.id)}
                    className="text-red-600 underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
