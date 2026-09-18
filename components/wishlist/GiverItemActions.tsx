"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HelpCircle, Info, Loader2, RotateCcw } from "lucide-react";
import gsap from "gsap";
import { VariantSelector } from "@/components/product/VariantSelector";
import { AuthGateSheet } from "@/components/wishlist/AuthGateSheet";
import { Button, buttonVariants } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
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
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authRedirectPath, setAuthRedirectPath] = useState(
    `/w/${shareId}/item/${item.id}`
  );
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
  const [reservedByMe, setReservedByMe] = useState(false);
  const [busy, setBusy] = useState(false);
  const detailPath = `/w/${shareId}/item/${item.id}`;
  const confirmPath = `/w/${shareId}/confirm/${item.id}`;
  const domain = getSourceDomain(item.product_url);

  const flaggedByMe = flagOwner === "me";
  const flaggedByOther = flagOwner === "other";
  // Someone holds a reservation on this one. Who, we are never told, and
  // the owner of the wishlist is never told at all (spec 0002, AC-20).
  const reservedByOther = Boolean(item.is_reserved) && !reservedByMe;
  const ctaHidden = (flaggedByOther || reservedByOther) && !buyAnyway;

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

  /**
   * The signed out entry point. Records what they were about to do on the
   * server, then opens the sign up sheet pointed at a resume link that
   * carries nothing but an opaque reference (spec 0002, AC-2, AC-5).
   */
  const startSignedOutGift = async (action: "reserve" | "buy") => {
    const response = await fetch("/api/gift/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wishlist_item_id: item.id,
        combination_key: selectedVariant?.combinationKey ?? null,
        selected_options: Object.keys(selectedOptions).length
          ? selectedOptions
          : null,
        intended_action: action,
      }),
    });

    const payload = (await response.json()) as {
      error?: string;
      resume_path?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || "Couldn't start this gift.");
    }

    trackEvent("gift.intent_created", { item_id: item.id, action });
    setAuthRedirectPath(payload.resume_path || detailPath);
    setAuthOpen(true);
  };

  const reserveGift = async () => {
    setFlagging(true);

    try {
      if (!isAuthenticated) {
        await startSignedOutGift("reserve");
        return;
      }

      const response = await fetch(`/api/wishlists/items/${item.id}/claim`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Couldn't reserve this gift.");
      }

      setReservedByMe(true);
      setFlagOwner("me");
      trackEvent("gift.reserved", { item_id: item.id });
      toast({ title: "Reserved for you.", variant: "success" });
      router.refresh();
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Couldn't reserve this gift. Try again.",
        variant: "danger",
      });
    } finally {
      setFlagging(false);
    }
  };

  const releaseGift = async () => {
    setClearing(true);

    try {
      const response = await fetch(`/api/wishlists/items/${item.id}/claim`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Couldn't release your reservation.");
      }

      setReservedByMe(false);
      setFlagOwner(null);
      trackEvent("gift.released", { item_id: item.id });
      router.refresh();
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Couldn't release your reservation.",
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
  const buyDisabled =
    !catalogProduct ||
    typeof unitPrice !== "number" ||
    !hasAllVariantSelections ||
    invalidCombination ||
    selectedVariant?.available === false;

  /**
   * Buying a catalogue gift no longer goes through the shared cart.
   *
   * It used to: the item went into the cart and a note of which wishlist
   * item it was for went into localStorage, which the checkout route then
   * trusted. That let a signed in buyer name any wishlist item they could
   * read and have the webhook mark somebody else's gift as bought. A gift
   * now has its own checkout route, and the wishlist association is
   * derived on the server from the reservation this call creates (spec
   * 0002, AC-38).
   */
  const buyGift = async () => {
    if (!catalogProduct || buyDisabled) {
      return;
    }

    setBusy(true);
    animateButton();

    try {
      if (!isAuthenticated) {
        await startSignedOutGift("buy");
        return;
      }

      const response = await fetch(`/api/wishlists/items/${item.id}/claim`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Couldn't start this purchase.");
      }

      setReservedByMe(true);
      trackEvent("shared_wishlist.item.buy_tapped", {
        item_id: item.id,
        origin: item.origin,
      });
      router.push(`/w/${shareId}/gift/${item.id}/checkout`);
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Couldn't start this purchase. Try again.",
        variant: "danger",
      });
    } finally {
      setBusy(false);
    }
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

      {(flaggedByOther || reservedByOther) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-6 text-amber-700">
          {reservedByOther
            ? "Someone has already reserved this one."
            : "Someone else is planning to buy this."}
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

                <Button
                  ref={buttonRef}
                  type="button"
                  fullWidth
                  size="lg"
                  disabled={buyDisabled || busy}
                  onClick={() => void buyGift()}
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Buy this gift
                </Button>
                {!isAuthenticated && (
                  <p className="text-center text-xs text-muted">
                    You&apos;ll sign in on the next step, and come straight
                    back to this gift.
                  </p>
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
          {!reservedByMe && !flaggedByMe && !reservedByOther && (
            <Button
              type="button"
              variant="ghost"
              fullWidth
              disabled={flagging}
              onClick={() => void reserveGift()}
            >
              {flagging && <Loader2 className="h-4 w-4 animate-spin" />}
              I&apos;m planning to buy this
            </Button>
          )}

          {(reservedByMe || flaggedByMe) && (
            <p className="text-center text-sm text-muted">
              ✓ You&apos;ve reserved this one.{" "}
              <button
                type="button"
                className="font-medium text-brand underline disabled:opacity-60"
                disabled={clearing}
                onClick={() => void releaseGift()}
              >
                Release
              </button>
            </p>
          )}
        </div>
      )}

      <AuthGateSheet
        open={authOpen}
        onOpenChange={setAuthOpen}
        redirectPath={authRedirectPath}
        receiverName={receiverName}
      />
    </>
  );
}
