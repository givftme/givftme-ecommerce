import { cn } from "@/lib/utils";
import { ProductCard, type ProductCardData } from "@/components/product/ProductCard";

export interface ProductGridProps {
  products: ProductCardData[];
  onToggleWishlist?: (id: string) => void;
  wishlistedIds?: Set<string>;
  showBadges?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function ProductGrid({
  products,
  onToggleWishlist,
  wishlistedIds,
  showBadges,
  emptyMessage = "No products to show yet.",
  className,
}: ProductGridProps) {
  if (products.length === 0) {
    return <p className="py-12 text-center text-muted">{emptyMessage}</p>;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4",
        className
      )}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onToggleWishlist={onToggleWishlist}
          isWishlisted={wishlistedIds?.has(product.id)}
          showBadges={showBadges}
        />
      ))}
    </div>
  );
}
