"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  Gift,
  Globe,
  Link2,
  Lock,
  PencilLine,
  Share2,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
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
import { getVisibilityLabel } from "@/lib/wishlist/display";
import type {
  WishlistDetail,
  WishlistItem,
  WishlistVisibility,
} from "@/lib/wishlist/types";
import { cn, formatPrice } from "@/lib/utils";
import { revalidateWishlistViews } from "@/app/(dashboard)/wishlists/actions";
import { AddItemSheet, type AddItemMode } from "@/components/wishlist/AddItemSheet";
import { EditItemSheet } from "@/components/wishlist/EditItemSheet";
import { EmptyWishlist } from "@/components/wishlist/EmptyWishlist";
import { WishlistItemCard } from "@/components/wishlist/WishlistItemCard";
import { ShareSettingsSheet } from "@/components/wishlist/ShareSettingsSheet";
import { WishlistTitleEditor } from "@/components/wishlist/WishlistTitleEditor";

const VISIBILITY_ICONS: Record<WishlistVisibility, LucideIcon> = {
  private: Lock,
  friends_family: Users,
  public: Globe,
};

// Catalogue first: it is the primary add path (see EmptyWishlist).
const ADD_OPTIONS: Array<{ mode: AddItemMode; label: string; icon: LucideIcon }> = [
  { mode: "catalog", label: "From Gifvtme store", icon: Store },
  { mode: "url", label: "Paste a link", icon: Link2 },
  { mode: "manual", label: "Write it", icon: PencilLine },
];

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-2xl bg-surface px-3.5 py-3", className)}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 wrap-break-word font-display text-2xl leading-tight text-ink">
        {value}
      </dd>
    </div>
  );
}

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

export function WishlistItemList({
  wishlist,
  initialAddMode,
}: {
  wishlist: WishlistDetail;
  initialAddMode?: AddItemMode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(() => sortItems(wishlist.items));
  const [serverItems, setServerItems] = useState(wishlist.items);
  const [addOpen, setAddOpen] = useState(Boolean(initialAddMode));
  const [addMode, setAddMode] = useState<AddItemMode>(initialAddMode || "catalog");
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WishlistItem | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [savedOrder, setSavedOrder] = useState(items);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // `items` is seeded once, so a refreshed server render would otherwise be
  // shadowed by the state from before the mutation: the page would show fresh
  // counts from the server and stale cards from local state. Re-seed whenever
  // the server hands us a new item list, except mid reorder where the local
  // order is the edit in progress. This is React's documented way to adjust
  // state when a prop changes, and it re-renders before anything is painted.
  if (!reorderMode && serverItems !== wishlist.items) {
    setServerItems(wishlist.items);
    setItems(sortItems(wishlist.items));
  }

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
  const listValue = availableItems.reduce(
    (sum, item) => sum + (item.price != null && item.price > 0 ? item.price : 0),
    0
  );
  const VisibilityIcon = VISIBILITY_ICONS[wishlist.visibility];

  // Every owner-facing surface has to agree with committed server state, not
  // just the card we touched: refresh this route and invalidate the sibling
  // routes whose cached payloads back/forward navigation would otherwise reuse.
  const syncServerState = () => {
    router.refresh();
    void revalidateWishlistViews(wishlist.id);
  };

  const openAddSheet = (mode: AddItemMode = "catalog") => {
    setAddMode(mode);
    setAddOpen(true);
  };

  const handleItemAdded = (item: WishlistItem) => {
    setItems((current) =>
      sortItems([
        ...current,
        { ...item, sort_order: current.length ? current.length : item.sort_order },
      ])
    );
    syncServerState();
  };

  const handleItemUpdated = (item: WishlistItem) => {
    setItems((current) =>
      current.map((currentItem) => (currentItem.id === item.id ? item : currentItem))
    );
    syncServerState();
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
      // Only drop the card once the server confirmed the delete, so a failed
      // mutation never looks like a successful removal.
      removeItemFromState(deleteTarget);
      toast({ title: "Item hidden from your list.", variant: "success" });
      setDeleteTarget(null);
      syncServerState();
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
      syncServerState();
    } catch {
      setItems(savedOrder);
      toast({ title: "Couldn't save new order.", variant: "danger" });
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <main className="min-h-dvh bg-surface pb-24 md:pb-10">
      {/* Mobile: cover, overview, add, items. Desktop: overview and add move
          into a sticky right column beside the cover and item list. */}
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 sm:px-5 md:py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <Link
            href="/wishlists"
            className="inline-flex h-10 w-fit items-center gap-2 rounded-full pl-1 pr-3 text-sm font-medium text-muted transition-colors hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            My wishlists
          </Link>

          <section
            aria-label="Wishlist cover"
            className="relative isolate flex min-h-52.5 flex-col justify-end overflow-hidden rounded-3xl bg-linear-to-br from-brand via-red to-orange p-5 pt-16 text-white sm:min-h-57.5 sm:rounded-[30px] sm:p-6 sm:pt-16"
          >
            <Gift
              aria-hidden="true"
              strokeWidth={1.25}
              className="pointer-events-none absolute -right-6 -bottom-8 -z-10 h-48 w-48 text-white/15 sm:h-60 sm:w-60"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-transparent via-transparent to-black/30"
            />

            <div className="absolute inset-x-4 top-4 flex flex-wrap items-start justify-between gap-2 sm:inset-x-5 sm:top-5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
                <VisibilityIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {getVisibilityLabel(wishlist.visibility)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-brand">
                <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                {wishlist.type === "evergreen" ? "Evergreen list" : "Occasion list"}
              </span>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <WishlistTitleEditor
                wishlistId={wishlist.id}
                initialTitle={wishlist.title}
                className="max-w-full"
                textClassName="font-display text-[32px] leading-tight text-white sm:text-5xl"
                inputClassName="h-14 font-display text-2xl text-ink"
                iconClassName="h-5 w-5 text-white/80 group-hover:text-white"
              />
              <p className="text-sm text-white/85">
                {visibleCount} {visibleCount === 1 ? "wish" : "wishes"}
                {purchasedItems.length > 0 &&
                  ` · ${purchasedItems.length} already gifted`}
              </p>
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <section
            aria-label="Wishlist overview"
            className="flex flex-col gap-4 rounded-[20px] bg-white p-4 sm:rounded-3xl sm:p-5"
          >
            <dl className="grid grid-cols-2 gap-2.5">
              <Stat label="Wishes" value={String(visibleCount)} />
              <Stat label="Already gifted" value={String(purchasedItems.length)} />
              <Stat
                label="List value"
                value={formatPrice(listValue)}
                className="col-span-2"
              />
            </dl>

            <div className="flex flex-col gap-1.5 text-sm text-muted">
              <p className="flex items-center gap-2">
                <VisibilityIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Visible to{" "}
                  <span className="font-medium text-ink">
                    {wishlist.visibility === "private"
                      ? "only you"
                      : getVisibilityLabel(wishlist.visibility)}
                  </span>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                Prices {wishlist.prices_visible ? "shown" : "hidden"} to friends
              </p>
            </div>

            <Button
              type="button"
              fullWidth
              onClick={() => setShareOpen(true)}
              className="shadow-soft"
            >
              <Share2 className="h-4 w-4" />
              Share list
            </Button>
          </section>

          <section
            aria-labelledby="add-wish-heading"
            className="flex flex-col gap-3 rounded-[20px] bg-white p-4 sm:rounded-3xl"
          >
            <h2 id="add-wish-heading" className="font-display text-xl text-ink">
              Add a wish
            </h2>
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 lg:flex-col">
              {ADD_OPTIONS.map(({ mode, label, icon: OptionIcon }, index) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => openAddSheet(mode)}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                    index === 0
                      ? "border-ink bg-ink text-white hover:bg-ink/85"
                      : "border-line bg-white text-muted hover:border-ink hover:text-ink"
                  )}
                >
                  <OptionIcon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section
          aria-labelledby="wishes-heading"
          className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-2"
        >
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 id="wishes-heading" className="font-display text-2xl text-ink">
              Your wishes
            </h2>
            {availableItems.length > 1 && (
              <button
                type="button"
                onClick={() => void toggleReorder()}
                disabled={isSavingOrder}
                aria-pressed={reorderMode}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50",
                  reorderMode
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink hover:border-ink"
                )}
              >
                {reorderMode ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                )}
                {reorderMode ? (isSavingOrder ? "Saving..." : "Done") : "Reorder"}
              </button>
            )}
          </div>

          {visibleCount === 0 ? (
            <EmptyWishlist wishlistId={wishlist.id} onAdd={openAddSheet} />
          ) : availableItems.length === 0 ? (
            <EmptyWishlist wishlistId={wishlist.id} onAdd={openAddSheet} allGifted />
          ) : (
            <div className="flex flex-col gap-2.5">
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
            <section className="mt-4 flex flex-col gap-2.5">
              <h2 className="px-1 font-display text-xl text-ink">
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
        </section>
      </div>

      <AddItemSheet
        wishlistId={wishlist.id}
        open={addOpen}
        onOpenChange={setAddOpen}
        mode={addMode}
        onModeChange={setAddMode}
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
        onItemDeleted={(item) => {
          removeItemFromState(item);
          syncServerState();
        }}
      />

      <ShareSettingsSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        wishlistId={wishlist.id}
        initialVisibility={wishlist.visibility}
        initialPricesVisible={wishlist.prices_visible}
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
