import { cn, formatPrice } from "@/lib/utils";

export interface PriceDisplayProps {
  price: number;
  compareAtPrice?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
} as const;

export function PriceDisplay({
  price,
  compareAtPrice,
  size = "md",
  className,
}: PriceDisplayProps) {
  const hasDiscount = compareAtPrice != null && compareAtPrice > price;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("font-semibold text-ink", sizeClasses[size])}>
        {formatPrice(price)}
      </span>
      {hasDiscount && (
        <span className={cn("text-muted line-through", sizeClasses[size])}>
          {formatPrice(compareAtPrice)}
        </span>
      )}
    </span>
  );
}
