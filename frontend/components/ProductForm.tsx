"use client";

import { FormEvent, useEffect, useState } from "react";
import { ProductInput } from "../lib/api/products";
import { listCategories, Category } from "../lib/api/categories";

export type ProductFormValues = {
  name: string;
  description: string;
  price: string; // dollars, as typed
  imageUrl: string;
  categoryId: string;
  stock: string;
};

const EMPTY_VALUES: ProductFormValues = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
  categoryId: "",
  stock: "",
};

export function ProductForm({
  initialValues,
  onSubmit,
  submitLabel,
}: {
  initialValues?: Partial<ProductFormValues>;
  onSubmit: (input: ProductInput) => Promise<void>;
  submitLabel: string;
}) {
  const [values, setValues] = useState<ProductFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  function setField<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const priceCents = Math.round(Number(values.price) * 100);
    const stock = Number(values.stock);

    if (!values.name.trim() || !values.description.trim()) {
      setError("Name and description are required.");
      return;
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      setError("Price must be a valid non-negative number.");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be a non-negative whole number.");
      return;
    }
    if (!values.categoryId) {
      setError("Select a category.");
      return;
    }
    if (!values.imageUrl.trim()) {
      setError("Image URL is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        description: values.description.trim(),
        priceCents,
        imageUrl: values.imageUrl.trim(),
        categoryId: values.categoryId,
        stock,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          value={values.name}
          onChange={(e) => setField("name", e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          value={values.description}
          onChange={(e) => setField("description", e.target.value)}
          rows={4}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="price" className="text-sm font-medium">
          Price ($)
        </label>
        <input
          id="price"
          type="number"
          min={0}
          step="0.01"
          value={values.price}
          onChange={(e) => setField("price", e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="imageUrl" className="text-sm font-medium">
          Image URL
        </label>
        <input
          id="imageUrl"
          value={values.imageUrl}
          onChange={(e) => setField("imageUrl", e.target.value)}
          placeholder="https://..."
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="categoryId" className="text-sm font-medium">
          Category
        </label>
        <select
          id="categoryId"
          value={values.categoryId}
          onChange={(e) => setField("categoryId", e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="stock" className="text-sm font-medium">
          Stock
        </label>
        <input
          id="stock"
          type="number"
          min={0}
          value={values.stock}
          onChange={(e) => setField("stock", e.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
