"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal, Plus } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { AddItemSheet } from "@/components/wishlist/AddItemSheet";
import { EditItemSheet } from "@/components/wishlist/EditItemSheet";
import { WishlistItemCard } from "@/components/wishlist/WishlistItemCard";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { OccasionHero } from "@/components/occasion/OccasionHero";
import { OccasionTypeSelector } from "@/components/occasion/OccasionTypeSelector";
import { PullFromEvergreen } from "@/components/occasion/PullFromEvergreen";
import { ReactivationPrompt } from "@/components/occasion/ReactivationPrompt";
import { ShareSettingsSheet } from "@/components/wishlist/ShareSettingsSheet";
import { OCCASION_LABELS } from "@/lib/occasion/constants";
import type { OccasionDetail, OccasionRecord, OccasionType } from "@/lib/occasion/types";
import {
  occasionBasicsSchema,
  type OccasionBasics,
  type OccasionBasicsInput,
} from "@/lib/occasion/validation";
import { trackEvent } from "@/lib/analytics";
import type { WishlistItem } from "@/lib/wishlist/types";

function normalizeWishlistItem(
  data: Partial<WishlistItem> & { id: string; wishlist_id?: string }
): WishlistItem {
  return {
    id: data.id,
    wishlist_id: data.wishlist_id || "",
    master_item_id: data.master_item_id || null,
    title: data.title || "",
    image_url: data.image_url || null,
    image_storage_path: data.image_storage_path || null,
    product_url: data.product_url || null,
    affiliate_url: data.affiliate_url || null,
    price: data.price ?? null,
    description: data.description || null,
    origin: data.origin || "external",
    catalog_product_id: data.catalog_product_id || null,
    status: data.status || "available",
    is_exclusive: Boolean(data.is_exclusive),
    sort_order: data.sort_order ?? 0,
    created_at: data.created_at || new Date().toISOString(),
    affiliate_purchased_at: data.affiliate_purchased_at || null,
    order_status: data.order_status || null,
    buyer_name: data.buyer_name || null,
  };
}

function sortItems(items: WishlistItem[]) {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    return (a.created_at || "").localeCompare(b.created_at || "");
  });
}

function EmptySection({ copy }: { copy: string }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white px-4 py-6 text-center shadow-sm">
      <p className="text-sm text-muted">{copy}</p>
    </div>
  );
}

function EditOccasionDialog({
  open,
  occasion,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  occasion: OccasionRecord;
  onOpenChange: (open: boolean) => void;
  onSaved: (occasion: OccasionRecord) => void;
}) {
  const { toast } = useToast();
  const form = useForm<OccasionBasicsInput, unknown, OccasionBasics>({
    resolver: zodResolver(occasionBasicsSchema),
    values: {
      title: occasion.title,
      occasion_type: occasion.occasion_type,
      occasion_date: occasion.occasion_date,
    },
  });

  const selectedType = useWatch({
    control: form.control,
    name: "occasion_type",
  }) as OccasionType | undefined;

  const save = async (values: OccasionBasics) => {
    try {
      const response = await fetch(`/api/occasions/${occasion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        occasion?: OccasionRecord;
        error?: string;
      };

      if (!response.ok || !payload.occasion) {
        throw new Error(payload.error || "Couldn't update occasion.");
      }

      onSaved(payload.occasion);
      toast({ title: "Occasion updated.", variant: "success" });
      onOpenChange(false);
    } catch {
      toast({ title: "Couldn't update occasion. Try again.", variant: "danger" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit occasion</DialogTitle>
          <DialogDescription>Update the details for this gifting moment.</DialogDescription>
        </DialogHeader>

        <form className="mt-6 space-y-5" onSubmit={form.handleSubmit(save)}>
          <OccasionTypeSelector
            value={selectedType}
            onChange={(value) =>
              form.setValue("occasion_type", value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />

          <label className="block space-y-2">
            <span className="text-xs font-medium text-ink">Occasion title</span>
            <Input {...form.register("title")} maxLength={100} />
            {form.formState.errors.title && (
              <span className="text-xs font-medium text-brand">
                {form.formState.errors.title.message}
              </span>
            )}
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-medium text-ink">When is it?</span>
            <Input type="date" {...form.register("occasion_date")} />
            {form.formState.errors.occasion_date && (
              <span className="text-xs font-medium text-brand">
                {form.formState.errors.occasion_date.message}
              </span>
            )}
          </label>

          <Button type="submit" fullWidth disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OccasionDetailClient({
  detail,
  createdType,
}: {
  detail: OccasionDetail;
  createdType?: OccasionType;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [occasion, setOccasion] = useState(detail.occasion);
  const [items, setItems] = useState(() => sortItems(detail.wishlist.items));
  const [evergreenItems, setEvergreenItems] = useState(detail.evergreenItems);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [addExclusiveOpen, setAddExclusiveOpen] = useState(false);
  const [addPulledOpen, setAddPulledOpen] = useState(false);
  const [selectedPulledIds, setSelectedPulledIds] = useState<string[]>([]);
  const [isAddingPulledItems, setIsAddingPulledItems] = useState(false);
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WishlistItem | null>(null);
  const archived = occasion.status === "archived";

  useEffect(() => {
    if (!createdType) {
      return;
    }

    toast({
      title: `Your ${OCCASION_LABELS[createdType]} occasion is ready to share`,
      variant: "success",
    });
    router.replace(`/my-occasions/${occasion.id}`);
  }, [createdType, occasion.id, router, toast]);

  const fromWishlistItems = useMemo(
    () => sortItems(items.filter((item) => item.master_item_id)),
    [items]
  );
  const exclusiveItems = useMemo(
    () => sortItems(items.filter((item) => item.is_exclusive && !item.master_item_id)),
    [items]
  );
  const alreadyPulledIds = useMemo(
    () =>
      new Set(
        items.map((item) => item.master_item_id).filter(Boolean) as string[]
      ),
    [items]
  );
  const remainingEvergreenItems = useMemo(
    () => evergreenItems.filter((item) => !alreadyPulledIds.has(item.id)),
    [alreadyPulledIds, evergreenItems]
  );
  const reactivationItems = detail.reactivationItems;

  const archiveOccasion = async () => {
    try {
      const response = await fetch(`/api/occasions/${occasion.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Archive failed.");
      }

      setOccasion((current) => ({
        ...current,
        status: "archived",
        archived_at: new Date().toISOString(),
      }));
      setDeleteOpen(false);
      toast({ title: "Occasion archived.", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Couldn't archive occasion. Try again.", variant: "danger" });
    }
  };

  const addPulledItems = async () => {
    if (selectedPulledIds.length === 0 || isAddingPulledItems) {
      return;
    }

    setIsAddingPulledItems(true);

    try {
      const response = await fetch(`/api/occasions/${occasion.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pulled_item_ids: selectedPulledIds }),
      });
      const payload = (await response.json()) as {
        items?: Array<Partial<WishlistItem> & { id: string }>;
        error?: string;
      };

      if (!response.ok || !payload.items) {
        throw new Error(payload.error || "Couldn't add items.");
      }

      setItems((current) =>
        sortItems([
          ...current,
          ...payload.items!.map((item) =>
            normalizeWishlistItem({ ...item, wishlist_id: detail.wishlist.id })
          ),
        ])
      );
      setEvergreenItems((current) =>
        current.filter((item) => !selectedPulledIds.includes(item.id))
      );
      setSelectedPulledIds([]);
      setAddPulledOpen(false);
      trackEvent("occasion.items.pulled", { item_count: payload.items.length });
      toast({ title: "Items added from your wishlist.", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Couldn't add items. Try again.", variant: "danger" });
    } finally {
      setIsAddingPulledItems(false);
    }
  };

  const deleteItem = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      const response = await fetch(
        `/api/wishlists/${detail.wishlist.id}/items/${deleteTarget.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ title: "Item removed from this occasion.", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Couldn't delete item. Try again.", variant: "danger" });
    }
  };

  const updateItem = (item: WishlistItem) => {
    setItems((current) =>
      current.map((currentItem) => (currentItem.id === item.id ? item : currentItem))
    );
    router.refresh();
  };

  const removeItemFromState = (item: WishlistItem) => {
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    router.refresh();
  };

  const renderItem = (item: WishlistItem, index: number, total: number) => (
    <WishlistItemCard
      key={item.id}
      item={item}
      index={index}
      total={total}
      reorderMode={false}
      readOnly={archived}
      onEdit={setEditingItem}
      onDelete={setDeleteTarget}
      onMoveUp={() => undefined}
      onMoveDown={() => undefined}
    />
  );

  return (
    <main className="min-h-dvh bg-surface pb-24 md:pb-10">
      <div className="mx-auto min-h-dvh max-w-4xl px-4 py-5 md:py-8">
        <header className="relative grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
          <Link
            href="/wishlists"
            aria-label="Back to wishlists"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <h1 className="truncate text-center text-lg font-semibold text-ink">
            {occasion.title}
          </h1>

          <button
            type="button"
            aria-label="Occasion menu"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 z-20 w-48 rounded-2xl border border-stone-100 bg-white p-2 shadow-lg">
              {!archived && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setEditOpen(true);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink hover:bg-brand-light hover:text-brand"
                >
                  Edit occasion
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShareOpen(true);
                }}
                className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-ink hover:bg-brand-light hover:text-brand"
              >
                Share wishlist
              </button>
              {!archived && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setDeleteOpen(true);
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete occasion
                </button>
              )}
            </div>
          )}
        </header>

        {archived && (
          <div className="mt-5 rounded-2xl bg-surface px-4 py-3 text-sm font-medium text-muted">
            Archived
          </div>
        )}

        {archived && reactivationItems.length > 0 && (
          <div className="mt-5">
            <ReactivationPrompt
              occasionId={occasion.id}
              occasionLabel={OCCASION_LABELS[occasion.occasion_type]}
              items={reactivationItems}
            />
          </div>
        )}

        <OccasionHero occasion={occasion} itemCount={items.length} />

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">
              From your wishlist ({fromWishlistItems.length})
            </h2>
          </div>
          {fromWishlistItems.length === 0 ? (
            <EmptySection copy="No main wishlist items have been added to this occasion yet." />
          ) : (
            <div className="space-y-3">
              {fromWishlistItems.map((item, index) =>
                renderItem(item, index, fromWishlistItems.length)
              )}
            </div>
          )}

          {!archived && (
            <button
              type="button"
              onClick={() => setAddPulledOpen(true)}
              className="mt-4 text-sm font-medium text-brand hover:text-brand-dark"
            >
              Add from wishlist
            </button>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">
              Only for this occasion ({exclusiveItems.length})
            </h2>
          </div>
          {exclusiveItems.length === 0 ? (
            <EmptySection copy="No occasion-only items yet." />
          ) : (
            <div className="space-y-3">
              {exclusiveItems.map((item, index) =>
                renderItem(item, index, exclusiveItems.length)
              )}
            </div>
          )}

          {!archived && (
            <Button
              type="button"
              variant="ghost"
              className="mt-4"
              onClick={() => setAddExclusiveOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add exclusive item
            </Button>
          )}
        </section>
      </div>

      <EditOccasionDialog
        open={editOpen}
        occasion={occasion}
        onOpenChange={setEditOpen}
        onSaved={(updated) => {
          setOccasion(updated);
          router.refresh();
        }}
      />

      <ShareSettingsSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        wishlistId={detail.wishlist.id}
        initialVisibility={detail.wishlist.visibility}
        initialPricesVisible={detail.wishlist.prices_visible}
        occasionTitle={occasion.title}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this occasion?</DialogTitle>
            <DialogDescription>
              This archives the occasion and keeps its wishlist history intact.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void archiveOccasion()}>
              Delete occasion
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addPulledOpen} onOpenChange={setAddPulledOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add from wishlist</DialogTitle>
            <DialogDescription>
              Choose remaining items from your main wishlist for this occasion.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <PullFromEvergreen
              items={remainingEvergreenItems}
              selectedIds={selectedPulledIds}
              onSelectedIdsChange={setSelectedPulledIds}
            />
          </div>
          <Button
            type="button"
            fullWidth
            className="mt-5"
            disabled={selectedPulledIds.length === 0 || isAddingPulledItems}
            onClick={() => void addPulledItems()}
          >
            {isAddingPulledItems ? "Adding..." : "Add selected"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this item?</DialogTitle>
            <DialogDescription>
              This removes it from this occasion only. Your main wishlist item stays intact.
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

      <AddItemSheet
        wishlistId={detail.wishlist.id}
        open={addExclusiveOpen}
        onOpenChange={setAddExclusiveOpen}
        existingItems={items}
        onItemAdded={(item) =>
          setItems((current) =>
            sortItems([...current, normalizeWishlistItem(item)])
          )
        }
        isExclusive
      />

      <EditItemSheet
        wishlistId={detail.wishlist.id}
        item={editingItem}
        open={Boolean(editingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingItem(null);
          }
        }}
        onItemUpdated={updateItem}
        onItemDeleted={removeItemFromState}
      />
    </main>
  );
}
