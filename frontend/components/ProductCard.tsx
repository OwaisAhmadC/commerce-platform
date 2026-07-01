import Link from "next/link";
import Image from "next/image";
import { Product } from "../lib/api/products";
import { formatPriceCents } from "../lib/format";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.id}`}
      className="flex flex-col overflow-hidden rounded border border-zinc-200 transition hover:shadow-md dark:border-zinc-800"
    >
      <div className="relative aspect-square w-full bg-zinc-100 dark:bg-zinc-900">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover"
          unoptimized
        />
        {product.stock === 0 && (
          <span className="absolute top-2 left-2 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white">
            Out of stock
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <span className="line-clamp-1 text-sm font-medium">{product.name}</span>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {formatPriceCents(product.priceCents)}
        </span>
      </div>
    </Link>
  );
}
