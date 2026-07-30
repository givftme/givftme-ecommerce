"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Gift, Loader2 } from "lucide-react";
import { AuthGateSheet } from "@/components/wishlist/AuthGateSheet";
import { Button } from "@/components/ui/Button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { trackEvent } from "@/lib/analytics";
import type { ProductCardData } from "@/lib/sanity/types";

interface WishlistSummary {
  id: string;
  title: string;
  type: "evergreen" | "occasion";
}

interface WishlistPickerSheetProps {
  product: ProductCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (catalogProductId: string) => void;
}

async function fetchWishlists() {
  const response = await fetch("/api/wishlists", {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Could not load wishlists.");
  }

  const payload = (await response.json()) as { wishlists?: WishlistSummary[] };
  return payload.wishlists || [];
}

async function createEvergreenWishlist() {
  const response = await fetch("/api/wishlists", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "evergreen" }),
  });

  if (!response.ok) {
    throw new Error("Could not create wishlist.");
  }

  const payload = (await response.json()) as { wishlist?: WishlistSummary };

  if (!payload.wishlist) {
    throw new Error("Could not create wishlist.");
  }

  return payload.wishlist;
}

export function WishlistPickerSheet({
  product,
  open,
  onOpenChange,
  onAdded,
}: WishlistPickerSheetProps) {
  const [wishlists, setWishlists] = useState<WishlistSummary[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSavingId, setIsSavingId] = useState<string | null>(null);
  const [isAuthGateOpen, setIsAuthGateOpen] = useState(false);
  const { toast } = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const redirectPath = `${pathname}${search ? `?${search}` : ""}`;

  const addToWishlist = async (wishlist: WishlistSummary) => {
    if (!product || typeof product.price !== "number") {
      toast({
        title: "Couldn't add to wishlist. Try again.",
        variant: "danger",
      });
      return;
    }

    setIsSavingId(wishlist.id);

    try {
      const response = await fetch(`/api/wishlists/${wishlist.id}/items`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: "catalog",
          catalog_product_id: product.catalogProductId,
          title: product.title,
          image_url: product.imageUrl || null,
          price: product.price,
          is_exclusive: false,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
           throw new Error(
          payload?.error || "Couldn't add to wishlist. Try again."
        );
      }

      trackEvent("museum.product.add_to_wishlist", {
        product_id: product.catalogProductId,
        wishlist_type: wishlist.type,
      });
      toast({ title: "Added to your wishlist ✓", variant: "success" });
      onAdded?.(product.catalogProductId);
      onOpenChange(false);
    } catch (error) {
      toast({
        title:
          error instanceof Error && error.message
            ? error.message
            : "Couldn't add to wishlist. Try again.",
        variant: "danger",
      });
    } finally {
      setIsSavingId(null);
    }
  };

  useEffect(() => {
    if (!open || !product) {
      return;
    }

    let isActive = true;

    const prepare = async () => {
      setIsPreparing(true);

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!isActive) {
          return;
        }

        if (!user) {
          onOpenChange(false);
          setIsAuthGateOpen(true);
          return;
        }

        let loadedWishlists = await fetchWishlists();

        if (loadedWishlists.length === 0) {
          loadedWishlists = [await createEvergreenWishlist()];
        }

        if (!isActive) {
          return;
        }

        if (loadedWishlists.length === 1) {
          await addToWishlist(loadedWishlists[0]);
          return;
        }

        setWishlists(loadedWishlists);
      } catch {
        toast({
          title: "Couldn't add to wishlist. Try again.",
          variant: "danger",
        });
        onOpenChange(false);
      } finally {
        if (isActive) {
          setIsPreparing(false);
        }
      }
    };

    void prepare();

    return () => {
      isActive = false;
    };
    // addToWishlist closes over transient saving state; running this only when
    // a product is chosen avoids retry loops while the user watches the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add to which wishlist?</SheetTitle>
            <SheetDescription>
              Choose where this catalog gift should be saved.
            </SheetDescription>
          </SheetHeader>

          {isPreparing ? (
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-surface p-4 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your wishlists...
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {wishlists.map((wishlist) => (
                <button
                  key={wishlist.id}
                  type="button"
                  onClick={() => addToWishlist(wishlist)}
                  disabled={isSavingId !== null}
                  className="flex w-full items-center justify-between rounded-2xl border border-stone-100 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand/40 disabled:opacity-60"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand">
                      <Gift className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {wishlist.type === "evergreen"
                          ? "My Wishlist"
                          : wishlist.title}
                      </span>
                      <span className="text-xs capitalize text-muted">
                        {wishlist.type}
                      </span>
                    </span>
                  </span>
                  {isSavingId === wishlist.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  ) : (
                    <span className="text-sm font-medium text-brand">Add</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5">
            <Button
              type="button"
              variant="text"
              fullWidth
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AuthGateSheet
        open={isAuthGateOpen}
        onOpenChange={setIsAuthGateOpen}
        redirectPath={redirectPath}
        description="You need an account to add to your wishlist."
      />
    </>
  );
}
