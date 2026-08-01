"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortableText } from "@portabletext/react";
import { Heart, HelpCircle, MessageCircle, Shirt, Star, Truck } from "lucide-react";
import type { SanityImageSource } from "@sanity/image-url";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { useToast } from "@/components/ui/Toast";
import { useCart } from "@/components/cart/CartContext";
import { FlashSaleTimer } from "@/components/flash-sale/FlashSaleTimer";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { RatingBreakdown } from "@/components/product/RatingBreakdown";
import { VariantSelector } from "@/components/product/VariantSelector";
import { WishlistPickerSheet } from "@/components/shared/WishlistPickerSheet";
import { urlFor } from "@/sanity/lib/image";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type {
  ProductCardData,
  ProductFullData,
  ProductReviewsSummary,
  ProductVariant,
} from "@/lib/sanity/types";

interface ProductDetailProps {
  product: ProductFullData;
  reviews: ProductReviewsSummary;
}

function optionsMatch(
  variant: ProductVariant,
  selectedOptions: Record<string, string>
) {
  return Object.entries(selectedOptions).every(([attribute, value]) =>
    variant.options.some(
      (option) => option.attribute === attribute && option.value === value
    )
  );
}

function getSelectedVariant(
  product: ProductFullData,
  selectedOptions: Record<string, string>
) {
  if (!product.hasVariants) {
    return null;
  }

  const hasAllSelections = product.attributes.every(
    (attribute) => selectedOptions[attribute.name]
  );

  if (!hasAllSelections) {
    return null;
  }

  return (
    product.variants.find((variant) => optionsMatch(variant, selectedOptions)) ||
    null
  );
}

function getDiscountPercent(price: number | null, compareAtPrice?: number | null) {
  if (
    typeof price !== "number" ||
    typeof compareAtPrice !== "number" ||
    compareAtPrice <= price
  ) {
    return null;
  }

  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

const portableTextComponents = {
  types: {
    image: ({ value }: { value: { alt?: string; asset?: unknown } }) => {
      if (!value?.asset) {
        return null;
      }

      return (
        <Image
          src={urlFor(value as SanityImageSource).width(900).fit("max").url()}
          alt={value.alt || ""}
          width={900}
          height={600}
          className="my-6 rounded-2xl"
        />
      );
    },
  },
};

export function ProductDetail({ product, reviews }: ProductDetailProps) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {}
  );
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"description" | "reviews">(
    "description"
  );
  const [visibleReviewCount, setVisibleReviewCount] = useState(10);
  const [isAdding, setIsAdding] = useState(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [saleEnded, setSaleEnded] = useState(false);
  const { addItem } = useCart();
  const { toast } = useToast();
  const router = useRouter();

  const selectedVariant = useMemo(
    () => getSelectedVariant(product, selectedOptions),
    [product, selectedOptions]
  );
  const hasAllVariantSelections =
    !product.hasVariants ||
    product.attributes.every((attribute) => selectedOptions[attribute.name]);
  const invalidCombination =
    Boolean(product.hasVariants) && hasAllVariantSelections && !selectedVariant;
  const missingAttribute = product.hasVariants
    ? product.attributes.find((attribute) => !selectedOptions[attribute.name])
    : undefined;
  const selectedVariantSoldOut =
    Boolean(selectedVariant) && selectedVariant?.available === false;
  const saleActive = Boolean(product.isOnFlashSale && !saleEnded);
  const basePrice =
    saleEnded && product.isOnFlashSale
      ? product.compareAtPrice ?? product.price
      : product.price;
  const baseCompareAtPrice = saleActive ? product.compareAtPrice : null;
  const unitPrice = product.hasVariants
    ? selectedVariant?.price ?? null
    : basePrice;
  const compareAtPrice = product.hasVariants
    ? selectedVariant?.compareAtPrice ?? null
    : baseCompareAtPrice;
  const disableCtas =
    typeof unitPrice !== "number" ||
    !hasAllVariantSelections ||
    invalidCombination ||
    selectedVariantSoldOut;
  const discountPercent = getDiscountPercent(basePrice, baseCompareAtPrice);
  const wishlistProduct: ProductCardData = {
    id: product.id,
    catalogProductId: product.catalogProductId,
    slug: product.slug,
    title: product.title,
    subtitle: product.subtitle,
    imageUrl: product.images[0]?.url || product.imageUrl || null,
    price: unitPrice,
    compareAtPrice,
    supplierProductId:
      selectedVariant?.supplierProductId || product.supplierProductId || null,
    hasVariants: false,
    isOnFlashSale: saleActive,
    saleEndTime: saleActive ? product.saleEndTime : null,
  };

  useEffect(() => {
    trackEvent("museum.product.viewed", {
      product_id: product.catalogProductId,
      has_variants: Boolean(product.hasVariants),
      is_on_sale: saleActive,
      price: unitPrice,
    });
  }, [product.catalogProductId, product.hasVariants, saleActive, unitPrice]);

  const addToCart = () => {
    if (disableCtas || typeof unitPrice !== "number") {
      return;
    }

    setIsAdding(true);
    addItem({
      catalog_product_id: product.catalogProductId,
      product_title: product.title,
      product_image_url: product.images[0]?.url || product.imageUrl || null,
      combination_key: selectedVariant?.combinationKey || null,
      selected_options: selectedOptions,
      quantity,
      unit_price: unitPrice,
      supplier_product_id:
        selectedVariant?.supplierProductId || product.supplierProductId || null,
    });
    trackEvent("museum.product.add_to_cart", {
      product_id: product.catalogProductId,
      variant_key: selectedVariant?.combinationKey || null,
      quantity,
      price: unitPrice,
    });
    toast({ title: "Added to cart ✓", variant: "success" });
    window.setTimeout(() => setIsAdding(false), 300);
  };

  const scrollToReviews = () => {
    setActiveTab("reviews");
    document
      .getElementById("reviews")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-2 lg:px-8">
        <ProductImageGallery
          productId={product.catalogProductId}
          title={product.title}
          images={product.images}
          isOnFlashSale={saleActive}
          discountPercent={discountPercent}
          isNew={product.isNew}
        />

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-ink lg:text-4xl">
              {product.title}
            </h1>
            {typeof unitPrice === "number" ? (
              <PriceDisplay
                price={unitPrice}
                compareAtPrice={compareAtPrice ?? undefined}
                size="lg"
              />
            ) : (
              <p className="text-lg font-semibold text-muted">Price not listed</p>
            )}
            {saleActive && product.saleEndTime ? (
              <p className="rounded-xl bg-brand-light px-4 py-3 text-sm font-semibold text-brand">
                Sale ends in{" "}
                <FlashSaleTimer
                  endTime={product.saleEndTime}
                  onComplete={() => {
                    setSaleEnded(true);
                    router.refresh();
                  }}
                  className="inline-block"
                />
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={scrollToReviews}
            className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-brand"
          >
            {reviews.count > 0 ? (
              <>
                <span className="flex items-center gap-1 text-amber-500">
                  <Star className="h-4 w-4" fill="currentColor" />
                  {reviews.avg.toFixed(1)}
                </span>
                <span>
                  ({reviews.count} {reviews.count === 1 ? "review" : "reviews"})
                </span>
              </>
            ) : (
              "No reviews yet"
            )}
          </button>

          {product.hasVariants ? (
            <VariantSelector
              productId={product.catalogProductId}
              attributes={product.attributes}
              variants={product.variants}
              selectedOptions={selectedOptions}
              onChange={setSelectedOptions}
            />
          ) : null}

          {missingAttribute ? (
            <p className="rounded-xl bg-surface px-4 py-3 text-sm font-medium text-muted">
              Please select a {missingAttribute.label}
            </p>
          ) : null}

          {invalidCombination ? (
            <p className="rounded-xl bg-surface px-4 py-3 text-sm font-medium text-muted">
              Unavailable in this combination
            </p>
          ) : null}

          {selectedVariantSoldOut ? (
            <p className="rounded-xl bg-surface px-4 py-3 text-sm font-medium text-muted">
              This variant is sold out.
            </p>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
            <span className="text-sm font-semibold text-ink">Quantity</span>
            <QuantityStepper value={quantity} onChange={setQuantity} min={1} max={99} />
          </div>

          <div className="rounded-2xl border border-stone-100 bg-white p-4 text-sm text-muted shadow-sm">
            <p>
              Estimated delivery:{" "}
              <span className="font-semibold text-ink">
                {product.estimatedDeliveryDays || "5-10 days"}
              </span>
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-2xl bg-surface p-4 text-sm text-muted">
            <input
              type="checkbox"
              checked
              readOnly
              className="mt-1 h-4 w-4 accent-brand"
            />
            <span>
              <span className="block font-semibold text-ink">
                Allow group payment
              </span>
              This allows multiple people to contribute to this wish.
            </span>
          </label>

          <div className="space-y-3">
            <Button
              type="button"
              fullWidth
              size="lg"
              disabled={disableCtas || isAdding}
              onClick={addToCart}
            >
              {isAdding ? "Adding..." : "Add to cart"}
            </Button>
            <Button
              type="button"
              fullWidth
              size="lg"
              variant="ghost"
              disabled={disableCtas}
              onClick={() => setIsWishlistOpen(true)}
            >
              <Heart className="h-4 w-4" />
              Add to wishlist
            </Button>
          </div>

          <div className="grid gap-3 text-sm text-muted sm:grid-cols-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 transition-colors hover:text-brand"
            >
              <HelpCircle className="h-4 w-4" />
              Ask a Question
            </button>
            <Dialog>
              <DialogTrigger className="inline-flex items-center gap-2 transition-colors hover:text-brand">
                <Shirt className="h-4 w-4" />
                Size Guide
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Size Guide</DialogTitle>
                  <DialogDescription>
                    Size details are provided by the catalog team per product.
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>
            <Link
              href="/shipping"
              className="inline-flex items-center gap-2 transition-colors hover:text-brand"
            >
              <Truck className="h-4 w-4" />
              Delivery Return
            </Link>
          </div>

          <dl className="grid gap-2 border-t border-stone-100 pt-5 text-sm">
            {product.baseSku || selectedVariant?.sku ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">SKU</dt>
                <dd className="text-right font-medium text-ink">
                  {selectedVariant?.sku || product.baseSku}
                </dd>
              </div>
            ) : null}
            {product.category ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Category</dt>
                <dd className="text-right font-medium text-ink">
                  {product.category}
                </dd>
              </div>
            ) : null}
            {product.tags.length > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Tags</dt>
                <dd className="text-right font-medium text-ink">
                  {product.tags.join(", ")}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      <section id="reviews" className="border-t border-stone-100 py-12">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex gap-2 border-b border-stone-100">
            {[
              { id: "description", label: "Description" },
              { id: "reviews", label: `Reviews (${reviews.count})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as "description" | "reviews")}
                className={cn(
                  "px-4 py-3 text-sm font-semibold transition-colors",
                  activeTab === tab.id
                    ? "border-b-2 border-brand text-brand"
                    : "text-muted hover:text-ink"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "description" ? (
            <div className="mt-8 max-w-none space-y-4 text-sm leading-7 text-muted">
              {product.description?.length ? (
                <PortableText
                  value={product.description}
                  components={portableTextComponents}
                />
              ) : (
                <p>{product.shortDescription || "No description available yet."}</p>
              )}
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <RatingBreakdown reviews={reviews} />

              {reviews.reviews.slice(0, visibleReviewCount).map((review) => (
                <article
                  key={review.id}
                  className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand">
                        {(review.reviewerName || "G").charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {review.reviewerName || "Gifvtme customer"}
                        </p>
                        {review.createdAt ? (
                          <p className="text-xs text-muted">
                            {new Date(review.createdAt).toLocaleDateString("en-NG", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-1 text-amber-500">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className="h-4 w-4"
                          fill={star <= review.rating ? "currentColor" : "none"}
                        />
                      ))}
                    </div>
                  </div>
                  {review.body ? (
                    <p className="mt-4 text-sm leading-6 text-muted">
                      {review.body}
                    </p>
                  ) : null}
                </article>
              ))}

              {reviews.reviews.length > visibleReviewCount ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setVisibleReviewCount((count) => count + 10)}
                >
                  Read More Reviews
                </Button>
              ) : null}

              {reviews.canLeaveReview ? (
                <Button type="button">
                  <MessageCircle className="h-4 w-4" />
                  Leave a review
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <WishlistPickerSheet
        product={wishlistProduct}
        open={isWishlistOpen}
        onOpenChange={setIsWishlistOpen}
      />

    </>
  );
}
