"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import gsap from "gsap";
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
import type { WishlistDetail, WishlistItem } from "@/lib/wishlist/types";
import { AddItemSheet } from "@/components/wishlist/AddItemSheet";
import { EditItemSheet } from "@/components/wishlist/EditItemSheet";
import { EmptyWishlist } from "@/components/wishlist/EmptyWishlist";
import { WishlistItemCard } from "@/components/wishlist/WishlistItemCard";
import { WishlistTitleEditor } from "@/components/wishlist/WishlistTitleEditor";

function sortItems(items: WishlistItem[]) {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    return (a.created_at || "").localeCompare(b.created_at || "");
  });
}

function moveItem(items: WishlistItem[], itemId: string, direction: -1 | 1) {
  const next = [...items];
  const index = next.findIndex((item) => item.id === itemId);
  const targetIndex = index + direction;

  if (index < 0 || targetIndex < 0 || targetIndex >= next.length) {
    return items;
  }

  const [item] = next.splice(index, 1);
  next.splice(targetIndex, 0, item);

  return next.map((row, sortOrder) => ({ ...row, sort_order: sortOrder }));
}

export function WishlistItemList({ wishlist }: { wishlist: WishlistDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(() => sortItems(wishlist.items));
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WishlistItem | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [savedOrder, setSavedOrder] = useState(items);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const sortedItems = useMemo(() => sortItems(items), [items]);
  const availableItems = useMemo(
    () => sortedItems.filter((item) => item.status === "available"),
    [sortedItems]
  );
  const purchasedItems = useMemo(
    () => sortedItems.filter((item) => item.status === "purchased"),
    [sortedItems]
  );
  const visibleCount = availableItems.length + purchasedItems.length;

  const handleItemAdded = (item: WishlistItem) => {
    setItems((current) =>
      sortItems([
        ...current,
        { ...item, sort_order: current.length ? current.length : item.sort_order },
      ])
    );
    router.refresh();
  };

  const handleItemUpdated = (item: WishlistItem) => {
    setItems((current) =>
      current.map((currentItem) => (currentItem.id === item.id ? item : currentItem))
    );
    router.refresh();
  };

  const removeItemFromState = (item: WishlistItem) => {
    setRemovingItemId(item.id);
    const node = document.querySelector(`[data-item-id="${item.id}"]`);

    if (node) {
      gsap.to(node, {
        opacity: 0,
        x: -30,
        height: 0,
        duration: 0.25,
        ease: "power2.in",
        onComplete: () => {
          setItems((current) => current.filter((row) => row.id !== item.id));
          setRemovingItemId(null);
        },
      });
      return;
    }

    setItems((current) => current.filter((row) => row.id !== item.id));
    setRemovingItemId(null);
  };

  const deleteItem = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      const response = await fetch(
        `/api/wishlists/${wishlist.id}/items/${deleteTarget.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      trackEvent("wishlist.item.deleted", { wishlist_item_id: deleteTarget.id });
      removeItemFromState(deleteTarget);
      toast({ title: "Item hidden from your list.", variant: "success" });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast({ title: "Couldn't delete item. Try again.", variant: "danger" });
    }
  };

  const handleMove = (itemId: string, direction: -1 | 1) => {
    setItems((current) => {
      const available = sortItems(current.filter((item) => item.status === "available"));
      const moved = moveItem(available, itemId, direction);
      const movedById = new Map(moved.map((item) => [item.id, item]));

      return current.map((item) => movedById.get(item.id) || item);
    });
  };

  const toggleReorder = async () => {
    if (!reorderMode) {
      setSavedOrder(items);
      setReorderMode(true);
      return;
    }

    setIsSavingOrder(true);

    try {
      const orderedIds = sortItems(
        items.filter((item) => item.status === "available")
      ).map((item) => item.id);
      const response = await fetch(`/api/wishlists/${wishlist.id}/items/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });

      if (!response.ok) {
        throw new Error("Reorder failed.");
      }

      trackEvent("wishlist.reordered", { item_count: orderedIds.length });
      toast({ title: "New order saved.", variant: "success" });
      setReorderMode(false);
      router.refresh();
    } catch {
      setItems(savedOrder);
      toast({ title: "Couldn't save new order.", variant: "danger" });
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <main className="min-h-dvh bg-surface pb-24 md:pb-10">
      <div className="mx-auto min-h-dvh max-w-4xl bg-white px-4 py-5 md:mt-6 md:min-h-0 md:rounded-2xl md:border md:border-stone-100 md:p-8 md:shadow-sm">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard/wishlists"
            aria-label="Back to wishlists"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <WishlistTitleEditor
            wishlistId={wishlist.id}
            initialTitle={wishlist.title}
            center
            className="min-w-0 flex-1"
            textClassName="text-lg font-semibold text-ink"
          />

          <button
            type="button"
            aria-label="Wishlist menu"
            onClick={() =>
              toast({
                title: "Wishlist settings coming soon.",
                description: "Sharing and visibility controls are part of the next spec.",
              })
            }
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </header>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">
              {visibleCount} {visibleCount === 1 ? "item" : "items"}
            </p>
            {purchasedItems.length > 0 && (
              <p className="text-xs text-muted">{purchasedItems.length} already gifted</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {availableItems.length > 1 && (
              <button
                type="button"
                onClick={() => void toggleReorder()}
                disabled={isSavingOrder}
                className="rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-brand-light hover:text-brand disabled:opacity-50"
              >
                {reorderMode ? (isSavingOrder ? "Saving..." : "Done") : "Reorder"}
              </button>
            )}
            <Button type="button" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </div>
        </div>

        {visibleCount === 0 ? (
          <EmptyWishlist onAdd={() => setAddOpen(true)} />
        ) : availableItems.length === 0 ? (
          <EmptyWishlist onAdd={() => setAddOpen(true)} allGifted />
        ) : (
          <div className="mt-6 space-y-3">
            {availableItems.map((item, index) => (
              <WishlistItemCard
                key={item.id}
                item={item}
                index={index}
                total={availableItems.length}
                reorderMode={reorderMode}
                isRemoving={removingItemId === item.id}
                onEdit={setEditingItem}
                onDelete={setDeleteTarget}
                onMoveUp={(itemId) => handleMove(itemId, -1)}
                onMoveDown={(itemId) => handleMove(itemId, 1)}
              />
            ))}
          </div>
        )}

        {purchasedItems.length > 0 && (
          <section className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold text-ink">
              Already gifted ({purchasedItems.length})
            </h2>
            {purchasedItems.map((item, index) => (
              <WishlistItemCard
                key={item.id}
                item={item}
                index={index}
                total={purchasedItems.length}
                reorderMode={false}
                onEdit={setEditingItem}
                onDelete={setDeleteTarget}
                onMoveUp={(itemId) => handleMove(itemId, -1)}
                onMoveDown={(itemId) => handleMove(itemId, 1)}
              />
            ))}
          </section>
        )}
      </div>

      <AddItemSheet
        wishlistId={wishlist.id}
        open={addOpen}
        onOpenChange={setAddOpen}
        existingItems={items}
        onItemAdded={handleItemAdded}
      />

      <EditItemSheet
        wishlistId={wishlist.id}
        item={editingItem}
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
          }
        }}
        onItemUpdated={handleItemUpdated}
        onItemDeleted={removeItemFromState}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this item?</DialogTitle>
            <DialogDescription>
              This hides the item from your wishlist without deleting its history.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void deleteItem()}>
              Delete item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
