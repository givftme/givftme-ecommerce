import { CatalogProductGrid } from "@/components/product/CatalogProductGrid";
import type { ProductCardData } from "@/lib/sanity/types";

export function RelatedProducts({ products }: { products: ProductCardData[] }) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-stone-100 py-14">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <h2 className="text-2xl font-semibold text-ink">You might also like</h2>
        <div className="mt-8">
          <CatalogProductGrid products={products} />
        </div>
      </div>
    </section>
  );
}
