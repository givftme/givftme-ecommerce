"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import type { WishlistItem } from "@/lib/wishlist/types";
import {
  editWishlistItemSchema,
  type EditWishlistItemFormValues,
  type EditWishlistItemInput,
} from "@/lib/wishlist/validation";
import { uploadWishlistImage } from "@/components/wishlist/uploadWishlistImage";

function EditItemForm({
  wishlistId,
  item,
  onOpenChange,
  onItemUpdated,
  onItemDeleted,
}: {
  wishlistId: string;
  item: WishlistItem;
  onOpenChange: (open: boolean) => void;
  onItemUpdated: (item: WishlistItem) => void;
  onItemDeleted: (item: WishlistItem) => void;
}) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = useForm<EditWishlistItemFormValues, unknown, EditWishlistItemInput>({
    resolver: zodResolver(editWishlistItemSchema),
    defaultValues: {
      title: item.title,
      image_url: item.image_storage_path || item.image_url,
      price: item.price,
      description: item.description || "",
    },
  });

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadPreview(URL.createObjectURL(file));
    setIsUploading(true);

    try {
      const imagePath = await uploadWishlistImage(file);
      form.setValue("image_url", imagePath, { shouldDirty: true });
    } catch (error) {
      toast({
        title: "Couldn't upload photo. Try again.",
        description: error instanceof Error ? error.message : undefined,
        variant: "danger",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const saveChanges = async (values: EditWishlistItemInput) => {
    try {
      const response = await fetch(`/api/wishlists/${wishlistId}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        item?: Partial<WishlistItem>;
        error?: string;
      };

      if (!response.ok || !payload.item) {
        throw new Error(payload.error || "Couldn't save changes.");
      }

      const updatedItem = {
        ...item,
        ...payload.item,
        title: payload.item.title || item.title,
      };

      onItemUpdated(updatedItem);
      trackEvent("wishlist.item.edited", { wishlist_item_id: item.id });
      toast({ title: "Item updated.", variant: "success" });
      onOpenChange(false);
    } catch {
      toast({ title: "Couldn't save changes. Try again.", variant: "danger" });
    }
  };

  const deleteItem = async () => {
    try {
      const response = await fetch(`/api/wishlists/${wishlistId}/items/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      trackEvent("wishlist.item.deleted", { wishlist_item_id: item.id });
      onItemDeleted(item);
      toast({ title: "Item hidden from your list.", variant: "success" });
      setConfirmDelete(false);
      onOpenChange(false);
    } catch {
      toast({ title: "Couldn't delete item. Try again.", variant: "danger" });
    }
  };

  const watchedImage = useWatch({ control: form.control, name: "image_url" });
  const imagePreview = uploadPreview || item.image_url || watchedImage;

  return (
    <>
      <form
        className="mt-6 space-y-5"
        onSubmit={form.handleSubmit((values) => saveChanges(values))}
      >
        {imagePreview && (
          <img
            src={imagePreview}
            alt=""
            className="h-28 w-28 rounded-xl object-cover"
          />
        )}

        <label className="block space-y-2">
          <span className="text-xs font-medium text-ink">Title</span>
          <Input {...form.register("title")} placeholder="Product title" />
          {form.formState.errors.title && (
            <span className="text-xs font-medium text-brand">
              {form.formState.errors.title.message}
            </span>
          )}
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-medium text-ink">Price</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">
              ₦
            </span>
            <Input
              type="number"
              min="0"
              step="1"
              className="pl-9"
              {...form.register("price", {
                setValueAs: (value) =>
                  value === "" ? null : Number.parseFloat(String(value)),
              })}
              placeholder="Optional"
            />
          </div>
          {form.formState.errors.price && (
            <span className="text-xs font-medium text-brand">
              {form.formState.errors.price.message}
            </span>
          )}
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-medium text-ink">Photo</span>
          <div className="rounded-xl border border-dashed border-stone-200 bg-surface p-4 text-center">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              className="hidden"
              id={`edit-wishlist-item-image-${item.id}`}
            />
            <label
              htmlFor={`edit-wishlist-item-image-${item.id}`}
              className="flex cursor-pointer flex-col items-center gap-2 text-sm text-muted"
            >
              {isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Upload className="h-6 w-6" strokeWidth={1.5} />
              )}
              {isUploading ? "Uploading..." : "Replace photo"}
            </label>
          </div>
        </label>

        <label className="block space-y-2">
          <span className="text-xs font-medium text-ink">Description</span>
          <Textarea
            {...form.register("description")}
            maxLength={500}
            placeholder="Optional note"
          />
          {form.formState.errors.description && (
            <span className="text-xs font-medium text-brand">
              {form.formState.errors.description.message}
            </span>
          )}
        </label>

        {item.product_url && (
          <p className="truncate text-xs text-muted">From: {item.product_url}</p>
        )}

        <Button
          type="submit"
          fullWidth
          disabled={form.formState.isSubmitting || isUploading}
        >
          {form.formState.isSubmitting ? "Saving..." : "Save changes"}
        </Button>

        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="w-full text-center text-sm font-medium text-red-600 hover:text-red-700"
        >
          Delete item
        </button>
      </form>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this item?</DialogTitle>
            <DialogDescription>
              {item.status === "purchased"
                ? "This item has been gifted. It will be hidden, but the purchase record is kept."
                : "This hides the item from your wishlist without deleting its history."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void deleteItem()}>
              Delete item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditItemSheet({
  wishlistId,
  item,
  open,
  onOpenChange,
  onItemUpdated,
  onItemDeleted,
}: {
  wishlistId: string;
  item: WishlistItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemUpdated: (item: WishlistItem) => void;
  onItemDeleted: (item: WishlistItem) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit item</SheetTitle>
          <SheetDescription>Update the details shown on your wishlist.</SheetDescription>
        </SheetHeader>

        {item && (
          <EditItemForm
            key={item.id}
            wishlistId={wishlistId}
            item={item}
            onOpenChange={onOpenChange}
            onItemUpdated={onItemUpdated}
            onItemDeleted={onItemDeleted}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
