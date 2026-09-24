"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { revalidateWishlistViews } from "@/app/(dashboard)/wishlists/actions";

/**
 * Deleting a wishlist archives its occasion through the existing occasion
 * DELETE handler. Nothing is destroyed: items, gift claims and orders keep
 * their history, the share page shows the occasion as passed, and the list
 * can be reactivated from its occasion page. Only occasion wishlists can be
 * deleted; the evergreen list is permanent.
 */
export function DeleteWishlistButton({
  occasionId,
  wishlistId,
  wishlistTitle,
  redirectTo,
  variant = "icon",
  className,
}: {
  occasionId: string;
  wishlistId: string | null;
  wishlistTitle: string;
  /** Where to go once archived. Stays on the page and refreshes when unset. */
  redirectTo?: string;
  variant?: "icon" | "button";
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteWishlist = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/occasions/${occasionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Archive failed.");
      }

      trackEvent("wishlist.deleted", { occasion_id: occasionId });
      toast({ title: "Wishlist deleted.", variant: "success" });
      setOpen(false);
      await revalidateWishlistViews(wishlistId ?? undefined);

      if (redirectTo) {
        router.push(redirectTo);
      }

      router.refresh();
    } catch {
      toast({ title: "Couldn't delete wishlist. Try again.", variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          aria-label={`Delete ${wishlistTitle}`}
          onClick={() => setOpen(true)}
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-line bg-white text-muted transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
            className
          )}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <Button
          type="button"
          variant="text"
          onClick={() => setOpen(true)}
          className={className}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete wishlist
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => !isDeleting && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{wishlistTitle}”?</DialogTitle>
            <DialogDescription>
              It moves to Past wishlists and its share link stops working. Gifts
              already claimed or bought are kept, and you can reactivate it later.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled={isDeleting}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={() => void deleteWishlist()}
            >
              {isDeleting ? "Deleting..." : "Delete wishlist"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
