import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "../../../lib/api/products";
import { ApiError } from "../../../lib/api/client";
import { formatPriceCents } from "../../../lib/format";
import { AddToCartForm } from "../../../components/AddToCartForm";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product;
  try {
    product = await getProduct(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:flex-row">
      <div className="relative aspect-square w-full flex-shrink-0 bg-zinc-100 sm:w-96 dark:bg-zinc-900">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 100vw, 384px"
          className="object-cover"
          unoptimized
        />
      </div>

      <div className="flex flex-col gap-3">
        <Link href="/" className="text-sm text-zinc-500 underline">
          &larr; Back to catalog
        </Link>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <p className="text-xl">{formatPriceCents(product.priceCents)}</p>
        <p className="text-zinc-600 dark:text-zinc-400">{product.description}</p>
        <p className="text-sm">
          {product.stock > 0 ? (
            <span className="text-green-700 dark:text-green-500">
              {product.stock} in stock
            </span>
          ) : (
            <span className="text-red-600">Out of stock</span>
          )}
        </p>
        <AddToCartForm productId={product.id} stock={product.stock} />
      </div>
    </main>
  );
}
