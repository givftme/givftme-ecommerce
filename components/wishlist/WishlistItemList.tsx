"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Eye,
  Gift,
  Globe,
  Link2,
  Lock,
  PencilLine,
  Settings2,
  Share2,
  Store,
  Users,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import gsap from "gsap";
import { Button, buttonVariants } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { OCCASION_EMOJIS, OCCASION_LABELS } from "@/lib/occasion/constants";
import { formatOccasionDate } from "@/lib/occasion/date";
import type { OccasionSummary } from "@/lib/occasion/types";
import { getWishlistCoverClass } from "@/lib/wishlist/covers";
import { getDaysToGoCopy, getVisibilityLabel } from "@/lib/wishlist/display";
import type {
  WishlistDetail,
  WishlistItem,
  WishlistVisibility,
} from "@/lib/wishlist/types";
import { cn, formatPrice } from "@/lib/utils";
import { revalidateWishlistViews } from "@/app/(dashboard)/wishlists/actions";
import { AddItemSheet, type AddItemMode } from "@/components/wishlist/AddItemSheet";
import { DeleteWishlistButton } from "@/components/wishlist/DeleteWishlistButton";
import { EditItemSheet } from "@/components/wishlist/EditItemSheet";
import { EmptyWishlist } from "@/components/wishlist/EmptyWishlist";
import { WishlistCoverPicker } from "@/components/wishlist/WishlistCoverPicker";
import { WishlistItemCard } from "@/components/wishlist/WishlistItemCard";
import { ShareSettingsSheet } from "@/components/wishlist/ShareSettingsSheet";
import { WishlistTitleEditor } from "@/components/wishlist/WishlistTitleEditor";

const VISIBILITY_OPTIONS: Array<{
  value: WishlistVisibility;
  icon: LucideIcon;
  shortLabel: string;
}> = [
  { value: "private", icon: Lock, shortLabel: "Private" },
  { value: "friends_family", icon: Users, shortLabel: "Friends" },
  { value: "public", icon: Globe, shortLabel: "Public" },
];

const VISIBILITY_ICONS: Record<WishlistVisibility, LucideIcon> = {
  private: Lock,
  friends_family: Users,
  public: Globe,
};

// Catalogue first: it is the primary add path (see EmptyWishlist).
const ADD_OPTIONS: Array<{ mode: AddItemMode; label: string; icon: LucideIcon }> = [
  { mode: "catalog", label: "From Gifvtme shop", icon: Store },
  { mode: "url", label: "Paste a link", icon: Link2 },
  { mode: "manual", label: "Write it", icon: PencilLine },
];

const coverPillClass =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";

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
  occasion = null,
  initialAddMode,
  sidebar,
  banner,
}: {
  wishlist: WishlistDetail;
  /** The occasion an occasion-type wishlist belongs to. */
  occasion?: OccasionSummary | null;
  initialAddMode?: AddItemMode;
  /** "My wishlists" navigation, rendered on the server. */
  sidebar?: ReactNode;
  /** Optional notice above the wishlist, e.g. reactivation prompts. */
  banner?: ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(() => sortItems(wishlist.items));
  const [serverItems, setServerItems] = useState(wishlist.items);
  const [addOpen, setAddOpen] = useState(Boolean(initialAddMode));
  const [addMode, setAddMode] = useState<AddItemMode>(initialAddMode || "catalog");
  const [addTab, setAddTab] = useState<AddItemMode>("catalog");
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WishlistItem | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [visibility, setVisibility] = useState(wishlist.visibility);
  const [serverVisibility, setServerVisibility] = useState(wishlist.visibility);
  const [cover, setCover] = useState(wishlist.cover_color);
  const [serverCover, setServerCover] = useState(wishlist.cover_color);

  // `items` is seeded once, so a refreshed server render would otherwise be
  // shadowed by the state from before the mutation: the page would show fresh
  // counts from the server and stale cards from local state. Re-seed whenever
  // the server hands us a new item list. This is React's documented way to
  // adjust state when a prop changes, and it re-renders before painting.
  if (serverItems !== wishlist.items) {
    setServerItems(wishlist.items);
    setItems(sortItems(wishlist.items));
  }

  // Visibility and cover can also change elsewhere (the share sheet, another
  // tab), so follow the server value whenever a refresh delivers a new one.
  if (serverVisibility !== wishlist.visibility) {
    setServerVisibility(wishlist.visibility);
    setVisibility(wishlist.visibility);
  }

  if (serverCover !== wishlist.cover_color) {
    setServerCover(wishlist.cover_color);
    setCover(wishlist.cover_color);
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
  const VisibilityIcon = VISIBILITY_ICONS[visibility];
  const title = occasion?.title ?? wishlist.title;

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

  const handleAddOpenChange = (open: boolean) => {
    setAddOpen(open);

    if (!open) {
      setPendingUrl(null);
    }
  };

  const submitLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = linkDraft.trim();

    if (!url) {
      setLinkError("Paste a product link first.");
      return;
    }

    setLinkError(null);
    setPendingUrl(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    setLinkDraft("");
    openAddSheet("url");
  };

  const changeVisibility = async (next: WishlistVisibility) => {
    if (next === visibility) {
      return;
    }

    const previous = visibility;
    setVisibility(next);

    try {
      const response = await fetch(`/api/wishlists/${wishlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });

      if (!response.ok) {
        throw new Error("Wishlist update failed.");
      }

      trackEvent("wishlist.visibility.changed", { from: previous, to: next });
      syncServerState();
    } catch {
      setVisibility(previous);
      toast({ title: "Couldn't update visibility.", variant: "danger" });
    }
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

  // Moving an item up saves straight away through the existing reorder
  // handler, and rolls back if the server rejects it.
  const moveUp = async (itemId: string) => {
    const previous = items;
    const available = sortItems(items.filter((item) => item.status === "available"));
    const moved = moveItem(available, itemId, -1);

    if (moved === available) {
      return;
    }

    const movedById = new Map(moved.map((item) => [item.id, item]));
    setItems((current) => current.map((item) => movedById.get(item.id) || item));
    setMovingItemId(itemId);

    try {
      const orderedIds = moved.map((item) => item.id);
      const response = await fetch(`/api/wishlists/${wishlist.id}/items/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });

      if (!response.ok) {
        throw new Error("Reorder failed.");
      }

      trackEvent("wishlist.reordered", { item_count: orderedIds.length });
      syncServerState();
    } catch {
      setItems(previous);
      toast({ title: "Couldn't save new order.", variant: "danger" });
    } finally {
      setMovingItemId(null);
    }
  };

  return (
    <main className="min-h-dvh bg-surface pb-24 md:pb-10">
      <div className="mx-auto grid w-full max-w-310 gap-5 px-4 py-5 sm:px-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-5.5 lg:py-8">
        {sidebar && <aside className="min-w-0 lg:sticky lg:top-6">{sidebar}</aside>}

        <div className="flex min-w-0 flex-col gap-4">
          {banner}

          <section
            aria-label="Wishlist cover"
            className={cn(
              "relative isolate flex min-h-52.5 flex-col justify-end overflow-hidden rounded-3xl p-5 pt-16 text-white transition-colors sm:min-h-57.5 sm:rounded-[30px] sm:p-6 sm:pt-16",
              getWishlistCoverClass(cover)
            )}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-transparent via-transparent to-black/35"
            />

            <div className="absolute inset-x-4 top-4 z-10 flex items-start justify-between gap-2 sm:inset-x-5 sm:top-5">
              <span className={cn(coverPillClass, "bg-black/30 backdrop-blur-sm")}>
                <VisibilityIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {getVisibilityLabel(visibility)}
              </span>
              <WishlistCoverPicker
                wishlistId={wishlist.id}
                value={cover}
                onChange={setCover}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-2.5">
              <div className="flex flex-wrap gap-2">
                {occasion ? (
                  <>
                    <span className={cn(coverPillClass, "bg-white text-brand")}>
                      <span aria-hidden="true">
                        {OCCASION_EMOJIS[occasion.occasion_type]}
                      </span>
                      {OCCASION_LABELS[occasion.occasion_type]}
                    </span>
                    <span className={cn(coverPillClass, "bg-black/30 backdrop-blur-sm")}>
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                      {formatOccasionDate(occasion.occasion_date)} ·{" "}
                      {getDaysToGoCopy(occasion.occasion_date)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={cn(coverPillClass, "bg-white text-brand")}>
                      <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                      Evergreen
                    </span>
                    <span className={cn(coverPillClass, "bg-black/30 backdrop-blur-sm")}>
                      Always open
                    </span>
                  </>
                )}
              </div>

              {occasion ? (
                // Occasion titles are renamed in occasion settings, which
                // keeps the occasion and its wishlist in step.
                <h1 className="truncate font-display text-[32px] leading-tight text-white sm:text-5xl">
                  {occasion.title}
                </h1>
              ) : (
                <WishlistTitleEditor
                  wishlistId={wishlist.id}
                  initialTitle={wishlist.title}
                  className="max-w-full"
                  textClassName="font-display text-[32px] leading-tight text-white sm:text-5xl"
                  inputClassName="h-14 font-display text-2xl text-ink"
                  iconClassName="h-5 w-5 text-white/80 group-hover:text-white"
                />
              )}
            </div>
          </section>

          <section
            aria-label="Wishlist overview"
            className="flex flex-col gap-4 rounded-[20px] bg-white p-4 sm:rounded-3xl sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="group"
                aria-label="Who can see this list"
                className="inline-flex max-w-full gap-0.5 rounded-2xl bg-surface p-1"
              >
                {VISIBILITY_OPTIONS.map(({ value, icon: OptionIcon, shortLabel }) => {
                  const label = getVisibilityLabel(value);

                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={visibility === value}
                      aria-label={label}
                      onClick={() => void changeVisibility(value)}
                      className={cn(
                        "inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:px-3",
                        visibility === value
                          ? "bg-white text-ink shadow-soft"
                          : "text-muted hover:text-ink"
                      )}
                    >
                      <OptionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sm:hidden">{shortLabel}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/w/${wishlist.id}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-4 text-sm font-medium text-ink transition-colors hover:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  Preview
                  <span className="sr-only">(opens in a new tab)</span>
                </Link>
                <Button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="h-10 shadow-soft"
                >
                  <Share2 className="h-4 w-4" />
                  Share list
                </Button>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat label="Items" value={String(visibleCount)} />
              <Stat
                label="List value"
                value={formatPrice(listValue)}
                className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
              />
              <Stat label="Already gifted" value={String(purchasedItems.length)} />
            </dl>

            {occasion && (
              <div className="-mb-1 flex flex-wrap items-center justify-between gap-1 border-t border-line pt-2">
                <Link
                  href={`/my-occasions/${occasion.id}`}
                  className={cn(buttonVariants({ variant: "text" }), "px-3")}
                >
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  Occasion settings
                </Link>
                <DeleteWishlistButton
                  variant="button"
                  occasionId={occasion.id}
                  wishlistId={wishlist.id}
                  wishlistTitle={title}
                  redirectTo="/wishlists"
                  className="px-3"
                />
              </div>
            )}
          </section>

          <section
            aria-label="Add a wish"
            className="flex flex-col gap-3 rounded-[20px] bg-white p-3.5 sm:rounded-3xl"
          >
            <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
              {ADD_OPTIONS.map(({ mode, label, icon: OptionIcon }) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={addTab === mode}
                  onClick={() => setAddTab(mode)}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                    addTab === mode
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-muted hover:border-ink hover:text-ink"
                  )}
                >
                  <OptionIcon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            {addTab === "url" && (
              <form onSubmit={submitLink} noValidate className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label htmlFor="wishlist-link" className="sr-only">
                    Product link
                  </label>
                  <input
                    id="wishlist-link"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    value={linkDraft}
                    onChange={(event) => {
                      setLinkDraft(event.target.value);
                      setLinkError(null);
                    }}
                    aria-invalid={Boolean(linkError)}
                    aria-describedby={linkError ? "wishlist-link-error" : undefined}
                    placeholder="Paste a link from Jumia, Konga, Amazon, Instagram…"
                    className="h-12 min-w-0 flex-1 rounded-2xl border-[1.5px] border-line bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand sm:text-sm"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white transition-colors hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    <WandSparkles className="h-4 w-4" aria-hidden="true" />
                    Fetch
                  </button>
                </div>
                {linkError && (
                  <p id="wishlist-link-error" className="px-1 text-xs text-brand">
                    {linkError}
                  </p>
                )}
              </form>
            )}

            {addTab === "catalog" && (
              <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">
                  Pick ready-to-gift items your friends can buy right here.
                </p>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => openAddSheet("catalog")}>
                    <Store className="h-4 w-4" />
                    Browse picks
                  </Button>
                  <Link
                    href={`/shop?wishlist=${wishlist.id}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    Full shop
                  </Link>
                </div>
              </div>
            )}

            {addTab === "manual" && (
              <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted">
                  Describe it yourself: a name, a rough price and a helpful detail.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={() => openAddSheet("manual")}
                >
                  <PencilLine className="h-4 w-4" />
                  Write it
                </Button>
              </div>
            )}
          </section>

          <section aria-labelledby="wishes-heading" className="flex min-w-0 flex-col gap-2.5">
            <h2 id="wishes-heading" className="sr-only">
              Your wishes
            </h2>

            {visibleCount === 0 ? (
              <EmptyWishlist wishlistId={wishlist.id} onAdd={openAddSheet} />
            ) : availableItems.length === 0 ? (
              <EmptyWishlist wishlistId={wishlist.id} onAdd={openAddSheet} allGifted />
            ) : (
              availableItems.map((item, index) => (
                <WishlistItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  isRemoving={removingItemId === item.id}
                  isMoving={movingItemId !== null}
                  onEdit={setEditingItem}
                  onDelete={setDeleteTarget}
                  onMoveUp={(itemId) => void moveUp(itemId)}
                />
              ))
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
                    onEdit={setEditingItem}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </section>
            )}
          </section>
        </div>
      </div>

      <AddItemSheet
        wishlistId={wishlist.id}
        open={addOpen}
        onOpenChange={handleAddOpenChange}
        mode={addMode}
        onModeChange={setAddMode}
        existingItems={items}
        onItemAdded={handleItemAdded}
        initialUrl={pendingUrl}
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

      {/* Keyed on visibility so the sheet re-seeds after an inline change, and
          synced on close so its own changes reach the page. */}
      <ShareSettingsSheet
        key={visibility}
        open={shareOpen}
        onOpenChange={(open) => {
          setShareOpen(open);

          if (!open) {
            syncServerState();
          }
        }}
        wishlistId={wishlist.id}
        initialVisibility={visibility}
        initialPricesVisible={wishlist.prices_visible}
        occasionTitle={occasion?.title}
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
