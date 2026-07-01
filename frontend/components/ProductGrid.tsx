import { Product } from "../lib/api/products";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ title, products }: { title: string; products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
