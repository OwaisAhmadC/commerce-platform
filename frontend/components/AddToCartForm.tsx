"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth/AuthContext";
import { addCartItem } from "../lib/api/cart";
import { ApiError } from "../lib/api/client";

export function AddToCartForm({ productId, stock }: { productId: string; stock: number }) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleAddToCart() {
    setError(null);

    if (!accessToken) {
      router.push("/login");
      return;
    }

    setStatus("loading");
    try {
      await addCartItem(accessToken, productId, quantity);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add to cart.");
      setStatus("idle");
    }
  }

  if (stock === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label htmlFor="quantity" className="text-sm font-medium">
          Quantity
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          max={stock}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.min(stock, Number(e.target.value) || 1)))}
          className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={status === "loading"}
        className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {status === "loading" ? "Adding..." : status === "done" ? "Added!" : "Add to cart"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
