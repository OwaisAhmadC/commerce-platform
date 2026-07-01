"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/auth/AuthContext";
import { createProduct, ProductInput } from "../../../../lib/api/products";
import { ProductForm } from "../../../../components/ProductForm";

export default function NewProductPage() {
  const { accessToken } = useAuth();
  const router = useRouter();

  async function handleSubmit(input: ProductInput) {
    if (!accessToken) throw new Error("Not authenticated");
    await createProduct(accessToken, input);
    router.push("/admin/products");
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">New Product</h1>
      <ProductForm onSubmit={handleSubmit} submitLabel="Create product" />
    </main>
  );
}
