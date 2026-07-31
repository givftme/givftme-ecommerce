"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HelpCircle, Info, Loader2, RotateCcw } from "lucide-react";
import gsap from "gsap";
import { useCart } from "@/components/cart/CartContext";
import { VariantSelector } from "@/components/product/VariantSelector";
import { AuthGateSheet } from "@/components/wishlist/AuthGateSheet";
import { Button, buttonVariants } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { setPendingWishlistItem } from "@/lib/checkout/pendingWishlistItem";
import { getSourceDomain } from "@/lib/wishlist/display";
import type { WishlistItem } from "@/lib/wishlist/types";
import type { ProductFullData, ProductVariant } from "@/lib/sanity/types";
import { cn } from "@/lib/utils";

type FlagOwner = "me" | "other" | null;

function findMatchingVariant(
  product: ProductFullData,
  selectedOptions: Record<string, string>
): ProductVariant | null {
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
    product.variants.find((variant) =>
      Object.entries(selectedOptions).every(([attribute, value]) =>
        variant.options.some(
          (option) => option.attribute === attribute && option.value === value
        )
      )
    ) || null
  );
}

export function GiverItemActions({
  item,
  shareId,
  receiverName,
  isAuthenticated,
  currentUserId,
  isOwner,
  externalUrl,
  catalogProduct,
}: {
  item: WishlistItem;
  shareId: string;
  receiverName: string;
  isAuthenticated: boolean;
  currentUserId: string | null;
  isOwner: boolean;
  externalUrl: string | null;
  catalogProduct: ProductFullData | null;
}) {
  const { toast } = useToast();
  const { addItem } = useCart();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [redirected, setRedirected] = useState(false);
  const [flagOwner, setFlagOwner] = useState<FlagOwner>(
    item.intent_flagged_by
      ? item.intent_flagged_by === currentUserId
        ? "me"
        : "other"
      : null
  );
  const [flagging, setFlagging] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [buyAnyway, setBuyAnyway] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {}
  );
  const [addedToCart, setAddedToCart] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const detailPath = `/w/${shareId}/item/${item.id}`;
  const confirmPath = `/w/${shareId}/confirm/${item.id}`;
  const domain = getSourceDomain(item.product_url);

  const flaggedByMe = flagOwner === "me";
  const flaggedByOther = flagOwner === "other";
  const ctaHidden = flaggedByOther && !buyAnyway;

  useEffect(() => {
    if (flaggedByOther) {
      trackEvent("shared_wishlist.intent_warning_seen", { item_id: item.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaggedByOther]);

  const requireAuth = () => {
    if (isAuthenticated) {
      return true;
    }

    setAuthOpen(true);
    return false;
  };

  const animateButton = () => {
    if (!buttonRef.current) {
      return;
    }

    gsap.to(buttonRef.current, {
      scale: 0.97,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: "power2.out",
    });
  };

  const buyExternal = () => {
    if (!requireAuth() || !externalUrl) {
      return;
    }

    animateButton();
    trackEvent("purchase.external.redirect", {
      item_id: item.id,
      domain: domain || "store",
      has_affiliate: Boolean(item.affiliate_url),
    });
    trackEvent("shared_wishlist.item.buy_tapped", {
      item_id: item.id,
      origin: item.origin,
    });
    window.open(externalUrl, "_blank", "noopener,noreferrer");
    setRedirected(true);
  };

  const flagIntent = async () => {
    if (!requireAuth()) {
      return;
    }

    setFlagging(true);

    try {
      const response = await fetch(
        `/api/wishlists/items/${item.id}/flag-intent`,
        { method: "POST" }
      );
      const payload = (await response.json()) as {
        error?: string;
        warning?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Intent flag failed.");
      }

      if (payload.warning === "already_flagged") {
        setFlagOwner("other");
        return;
      }

      setFlagOwner("me");
      trackEvent("shared_wishlist.intent_flagged", { item_id: item.id });
      toast({ title: "Intent noted.", variant: "success" });
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Couldn't flag this gift. Try again.",
        variant: "danger",
      });
    } finally {
      setFlagging(false);
    }
  };

  const clearIntent = async () => {
    setClearing(true);

    try {
      const response = await fetch(
        `/api/wishlists/items/${item.id}/flag-intent`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Couldn't remove your flag.");
      }

      setFlagOwner(null);
      trackEvent("shared_wishlist.intent_cleared", { item_id: item.id });
    } catch (error) {
      toast({
        title:
          error instanceof Error ? error.message : "Couldn't remove your flag.",
        variant: "danger",
      });
    } finally {
      setClearing(false);
    }
  };

  const selectedVariant = catalogProduct
    ? findMatchingVariant(catalogProduct, selectedOptions)
    : null;
  const hasAllVariantSelections =
    !catalogProduct?.hasVariants ||
    catalogProduct.attributes.every((attribute) => selectedOptions[attribute.name]);
  const invalidCombination =
    Boolean(catalogProduct?.hasVariants) &&
    hasAllVariantSelections &&
    !selectedVariant;
  const unitPrice = catalogProduct?.hasVariants
    ? selectedVariant?.price ?? null
    : catalogProduct?.price ?? null;
  const addToCartDisabled =
    !catalogProduct ||
    typeof unitPrice !== "number" ||
    !hasAllVariantSelections ||
    invalidCombination ||
    selectedVariant?.available === false;

  const addToCart = () => {
    if (!requireAuth() || !catalogProduct || addToCartDisabled) {
      return;
    }

    addItem({
      catalog_product_id: catalogProduct.catalogProductId,
      product_title: catalogProduct.title,
      product_image_url:
        catalogProduct.images[0]?.url || catalogProduct.imageUrl || null,
      combination_key: selectedVariant?.combinationKey || null,
      selected_options: selectedOptions,
      quantity: 1,
      unit_price: unitPrice as number,
      supplier_product_id:
        selectedVariant?.supplierProductId ||
        catalogProduct.supplierProductId ||
        null,
    });
    setPendingWishlistItem({
      wishlistItemId: item.id,
      catalogProductId: catalogProduct.catalogProductId,
    });
    trackEvent("shared_wishlist.item.add_to_cart", {
      item_id: item.id,
      has_variant: Boolean(catalogProduct.hasVariants),
    });
    setAddedToCart(true);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <>
      {item.origin === "external" && domain && (
        <div className="rounded-xl bg-surface p-4">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
            <p className="text-sm leading-6 text-muted">
              You&apos;ll be redirected to {domain} to complete your purchase.
              The item will be marked as claimed so no one buys it twice.
            </p>
          </div>
        </div>
      )}

      {flaggedByOther && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-700">
          Someone else is planning to buy this.
          {!buyAnyway && (
            <>
              {" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setBuyAnyway(true);
                  trackEvent("shared_wishlist.buy_anyway_clicked", {
                    item_id: item.id,
                  });
                }}
              >
                Buy anyway
              </button>
            </>
          )}
        </div>
      )}

      {!ctaHidden && (
        <div className="space-y-3">
          {item.origin === "catalog" ? (
            catalogProduct ? (
              <>
                {catalogProduct.hasVariants && (
                  <VariantSelector
                    productId={catalogProduct.catalogProductId}
                    attributes={catalogProduct.attributes}
                    variants={catalogProduct.variants}
                    selectedOptions={selectedOptions}
                    onChange={setSelectedOptions}
                  />
                )}

                {invalidCombination && (
                  <p className="rounded-xl bg-surface px-4 py-3 text-sm font-medium text-muted">
                    This combination is currently unavailable.
                  </p>
                )}

                {addedToCart ? (
                  justAdded ? (
                    <Button type="button" fullWidth size="lg" disabled>
                      Added ✓
                    </Button>
                  ) : (
                    <Link
                      href="/cart"
                      className={cn(buttonVariants({ fullWidth: true, size: "lg" }))}
                    >
                      View cart
                    </Link>
                  )
                ) : (
                  <Button
                    type="button"
                    fullWidth
                    size="lg"
                    disabled={addToCartDisabled}
                    onClick={addToCart}
                  >
                    Add to cart
                  </Button>
                )}
              </>
            ) : (
              <div className="rounded-2xl bg-surface p-4 text-sm leading-6 text-muted">
                No longer available.
              </div>
            )
          ) : (
            <>
              <Button
                ref={buttonRef}
                type="button"
                fullWidth
                size="lg"
                disabled={!externalUrl}
                onClick={buyExternal}
              >
                Buy this gift
              </Button>
              {domain && (
                <p className="text-center text-xs text-muted">
                  Opens {domain} in a new tab
                </p>
              )}
            </>
          )}

          {redirected && (
            <div className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
              <p className="text-sm leading-6 text-muted">
                Once you&apos;ve bought it on {domain || "the store"}, come back
                and confirm below.
              </p>
              <Link
                href={confirmPath}
                className={cn(buttonVariants({ fullWidth: true }), "mt-3")}
              >
                I bought it
              </Link>
            </div>
          )}
        </div>
      )}

      {item.origin === "catalog" && (
        <div className="flex items-center justify-center gap-4 text-xs font-medium text-muted">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-brand-light hover:text-brand"
          >
            <HelpCircle className="h-4 w-4" />
            Ask a Question
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors hover:bg-brand-light hover:text-brand"
          >
            <RotateCcw className="h-4 w-4" />
            Delivery Return
          </button>
        </div>
      )}

      {!isOwner && (
        <div className="space-y-2">
          {flagOwner === null && (
            <Button
              type="button"
              variant="ghost"
              fullWidth
              disabled={flagging}
              onClick={() => void flagIntent()}
            >
              {flagging && <Loader2 className="h-4 w-4 animate-spin" />}
              I&apos;m planning to buy this
            </Button>
          )}

          {flaggedByMe && (
            <p className="text-center text-sm text-muted">
              ✓ You&apos;ve marked this as planned.{" "}
              <button
                type="button"
                className="font-medium text-brand underline disabled:opacity-60"
                disabled={clearing}
                onClick={() => void clearIntent()}
              >
                Remove
              </button>
            </p>
          )}
        </div>
      )}

      <AuthGateSheet
        open={authOpen}
        onOpenChange={setAuthOpen}
        redirectPath={detailPath}
        receiverName={receiverName}
      />
    </>
  );
}
