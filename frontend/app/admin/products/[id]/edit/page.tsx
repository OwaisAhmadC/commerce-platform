"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../../lib/auth/AuthContext";
import { getProduct, updateProduct, ProductInput } from "../../../../../lib/api/products";
import { ProductForm, ProductFormValues } from "../../../../../components/ProductForm";
import { ApiError } from "../../../../../lib/api/client";

export default function EditProductPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [initialValues, setInitialValues] = useState<Partial<ProductFormValues> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProduct(params.id)
      .then((product) =>
        setInitialValues({
          name: product.name,
          description: product.description,
          price: (product.priceCents / 100).toString(),
          imageUrl: product.imageUrl,
          categoryId: product.categoryId,
          stock: product.stock.toString(),
        }),
      )
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load product."));
  }, [params.id]);

  async function handleSubmit(input: ProductInput) {
    if (!accessToken) throw new Error("Not authenticated");
    await updateProduct(accessToken, params.id, input);
    router.push("/admin/products");
  }

  if (error) {
    return <main className="p-6 text-sm text-red-600">{error}</main>;
  }

  if (!initialValues) {
    return <main className="p-6 text-sm text-zinc-500">Loading...</main>;
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Edit Product</h1>
      <ProductForm initialValues={initialValues} onSubmit={handleSubmit} submitLabel="Save changes" />
    </main>
  );
}
