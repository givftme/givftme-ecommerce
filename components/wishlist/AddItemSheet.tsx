"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Check,
  Menu,
  Minus,
  Plus,
  ShoppingCart,
  Upload,
} from "lucide-react";
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
import { Sheet, SheetContent } from "@/components/ui/Sheet";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import type { ScrapedProduct } from "@/lib/scraper/microlink";
import { isWishlistStoragePath } from "@/lib/wishlist/images";
import type { WishlistItem } from "@/lib/wishlist/types";
import {
  externalWishlistItemSchema,
  type ExternalWishlistItemFormValues,
  type ExternalWishlistItemInput,
} from "@/lib/wishlist/validation";
import { uploadWishlistImage } from "@/components/wishlist/uploadWishlistImage";

const FETCH_SLOW_THRESHOLD_MS = 5000;

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function makeWishlistItem(data: Partial<WishlistItem> & { id: string }): WishlistItem {
  return {
    wishlist_id: data.wishlist_id || "",
    master_item_id: data.master_item_id || null,
    title: data.title || "",
    image_url: data.image_url || null,
    image_storage_path:
      data.image_storage_path ||
      (data.image_url && isWishlistStoragePath(data.image_url) ? data.image_url : null),
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
    id: data.id,
  };
}

export function AddItemSheet({
  wishlistId,
  open,
  onOpenChange,
  existingItems,
  onItemAdded,
  isExclusive = false,
  draftMode = false,
}: {
  wishlistId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingItems: WishlistItem[];
  onItemAdded: (item: WishlistItem) => void;
  isExclusive?: boolean;
  draftMode?: boolean;
}) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [duplicateItem, setDuplicateItem] = useState<WishlistItem | null>(null);
  const [pendingSave, setPendingSave] = useState<ExternalWishlistItemInput | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [allowGroupPayment, setAllowGroupPayment] = useState(true);
  const [activeTab, setActiveTab] = useState<"url" | "manual">("url");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchSlow, setFetchSlow] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [hasFetchedPreview, setHasFetchedPreview] = useState(false);
  const scrapeAbortRef = useRef<AbortController | null>(null);

  const form = useForm<
    ExternalWishlistItemFormValues,
    unknown,
    ExternalWishlistItemInput
  >({
    resolver: zodResolver(externalWishlistItemSchema),
    defaultValues: {
      origin: "external",
      title: "",
      product_url: "",
      image_url: null,
      price: null,
      description: "",
      scraped_currency: null,
      is_exclusive: isExclusive,
    },
  });

  const watchedImage = useWatch({ control: form.control, name: "image_url" });
  const watchedProductUrl = useWatch({ control: form.control, name: "product_url" });
  const watchedCurrency = useWatch({ control: form.control, name: "scraped_currency" });
  const isForeignCurrency = Boolean(watchedCurrency && watchedCurrency !== "NGN");

  const resetSheet = () => {
    setDuplicateItem(null);
    setPendingSave(null);
    setUploadPreview(null);
    setQuantity(0);
    setAllowGroupPayment(true);
    setActiveTab("url");
    setIsFetching(false);
    setFetchSlow(false);
    setScrapeError(null);
    setHasFetchedPreview(false);
    form.reset({
      origin: "external",
      title: "",
      product_url: "",
      image_url: null,
      price: null,
      description: "",
      scraped_currency: null,
      is_exclusive: isExclusive,
    });
  };

  const closeSheet = () => {
    onOpenChange(false);
    resetSheet();
  };

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
      trackEvent("wishlist.item.image_uploaded", { source: "upload" });
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

  const skipToManual = (reason: "user_skipped" | "scrape_failed") => {
    scrapeAbortRef.current?.abort();
    setIsFetching(false);
    setFetchSlow(false);
    setActiveTab("manual");
    trackEvent("wishlist.item.manual_fallback_used", { reason });
  };

  const switchToManualTab = () => {
    scrapeAbortRef.current?.abort();
    setIsFetching(false);
    setFetchSlow(false);
    setActiveTab("manual");
  };

  const switchToUrlTab = () => {
    setActiveTab("url");
  };

  const handleFetch = async () => {
    const url = form.getValues("product_url");
    const domain = hostnameOf(url || "");

    if (!domain) {
      form.setError("product_url", { message: "Enter a valid product URL" });
      return;
    }

    const controller = new AbortController();
    scrapeAbortRef.current = controller;
    setScrapeError(null);
    setIsFetching(true);
    setFetchSlow(false);
    trackEvent("wishlist.item.scrape_attempted", { domain });

    const slowTimer = setTimeout(() => setFetchSlow(true), FETCH_SLOW_THRESHOLD_MS);

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        product?: ScrapedProduct;
        error?: string;
      };

      if (!response.ok || !payload.product) {
        throw new Error(payload.error || "We couldn't read that page automatically.");
      }

      form.setValue("title", payload.product.title, { shouldDirty: true });
      form.setValue("image_url", payload.product.image_url, { shouldDirty: true });
      form.setValue("price", payload.product.price, { shouldDirty: true });
      form.setValue("product_url", payload.product.product_url, { shouldDirty: true });
      form.setValue("scraped_currency", payload.product.currency, {
        shouldDirty: true,
      });
      setHasFetchedPreview(true);
      setIsFetching(false);
      setFetchSlow(false);
      trackEvent("wishlist.item.scrape_succeeded", { domain });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const reason =
        error instanceof Error ? error.message : "We couldn't read that page automatically.";
      trackEvent("wishlist.item.scrape_failed", { domain, reason });
      setScrapeError(reason);
      skipToManual("scrape_failed");
    } finally {
      clearTimeout(slowTimer);
    }
  };

  const saveItem = async (values: ExternalWishlistItemInput, allowDuplicate = false) => {
    const duplicate = existingItems.find(
      (item) => item.product_url && item.product_url === values.product_url
    );

    if (duplicate && !allowDuplicate) {
      setDuplicateItem(duplicate);
      setPendingSave(values);
      return;
    }

    if (draftMode || !wishlistId) {
      onItemAdded(
        makeWishlistItem({
          ...values,
          image_url:
            values.image_url && isWishlistStoragePath(values.image_url)
              ? uploadPreview || values.image_url
              : values.image_url,
          image_storage_path:
            values.image_url && isWishlistStoragePath(values.image_url)
              ? values.image_url
              : null,
          id: crypto.randomUUID(),
          is_exclusive: isExclusive,
          sort_order: existingItems.length,
          created_at: new Date().toISOString(),
        })
      );
      toast({
        title: isExclusive ? "Added to this occasion." : "Added to your wishlist.",
        variant: "success",
      });
      closeSheet();
      return;
    }

    try {
      const response = await fetch(`/api/wishlists/${wishlistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, is_exclusive: isExclusive }),
      });
      const payload = (await response.json()) as {
        item?: Partial<WishlistItem>;
        error?: string;
      };

      if (!response.ok || !payload.item?.id) {
        throw new Error(payload.error || "Couldn't save item.");
      }

      onItemAdded(makeWishlistItem(payload.item as Partial<WishlistItem> & { id: string }));
      trackEvent("wishlist.item.added", {
        origin: "external",
        has_price: Boolean(values.price),
        has_image: Boolean(values.image_url),
        scraped: hasFetchedPreview,
      });
      if (!values.image_url) {
        trackEvent("wishlist.item.image_skipped");
      }
      toast({ title: "Added to your wishlist.", variant: "success" });
      closeSheet();
    } catch {
      toast({ title: "Couldn't save item. Try again.", variant: "danger" });
    }
  };

  const imagePreview = uploadPreview || watchedImage;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          onOpenChange(nextOpen);
          if (!nextOpen) {
            resetSheet();
          }
        }}
      >
        <SheetContent
          showClose={false}
          className="inset-x-0 bottom-0 top-0 max-h-dvh overflow-y-auto rounded-none border-0 bg-white p-0 shadow-none md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[92dvh] md:max-w-[520px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:border-stone-100 md:shadow-lg lg:max-w-[600px]"
        >
          <div className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col bg-white md:min-h-0 md:max-w-none">
            <header className="flex h-[92px] items-end justify-between px-4 pb-3 md:h-16 md:items-center md:px-6 md:pb-0">
              <button
                type="button"
                aria-label="Go back"
                onClick={closeSheet}
                className="flex h-10 w-10 items-center justify-start text-muted transition-colors hover:text-ink"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-lg font-medium text-ink">Wishlist</h2>
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-brand" strokeWidth={1.8} />
                <Menu className="h-6 w-6 text-muted" strokeWidth={1.8} />
              </div>
            </header>

            <form
              className="flex flex-1 flex-col px-4 pb-5 md:px-6 md:pb-6"
              onSubmit={form.handleSubmit((values) => saveItem(values))}
              onKeyDown={(event) => {
                const target = event.target as HTMLElement;

                if (
                  event.key === "Enter" &&
                  target.tagName !== "TEXTAREA" &&
                  target.tagName !== "BUTTON"
                ) {
                  event.preventDefault();
                }
              }}
            >
              <div>
                <h3 className="text-xl font-bold leading-6 text-ink">New wishlist</h3>
                <p className="mt-2 max-w-[330px] text-[13px] leading-5 text-ink">
                  Add a new item to your wishlist.
                </p>
              </div>

              <div className="mt-5 inline-flex rounded-xl bg-surface p-1">
                <button
                  type="button"
                  onClick={switchToUrlTab}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "url" ? "bg-white text-ink shadow-sm" : "text-muted"
                  }`}
                >
                  Add from URL
                </button>
                <button
                  type="button"
                  onClick={switchToManualTab}
                  className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === "manual" ? "bg-white text-ink shadow-sm" : "text-muted"
                  }`}
                >
                  Add manually
                </button>
              </div>

              {activeTab === "url" && !hasFetchedPreview && (
                <div className="mt-4">
                  <label className="block">
                    <span className="sr-only">Product URL</span>
                    <Input
                      type="url"
                      {...form.register("product_url")}
                      placeholder="Paste a product URL"
                      className="h-[52px] rounded-xl border-[#c9d5e5] px-4 text-sm placeholder:text-[#cbd6e6]"
                    />
                    {form.formState.errors.product_url && (
                      <span className="mt-1 block text-xs font-medium text-brand">
                        {form.formState.errors.product_url.message}
                      </span>
                    )}
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    fullWidth
                    disabled={isFetching}
                    onClick={handleFetch}
                    className="mt-3 h-12 rounded-xl text-sm"
                  >
                    {isFetching ? "Fetching..." : "Fetch"}
                  </Button>

                  {scrapeError && (
                    <p className="mt-2 text-xs font-medium text-brand">{scrapeError}</p>
                  )}

                  {fetchSlow && (
                    <div className="mt-2 flex items-center justify-between text-xs text-muted">
                      <span>This is taking a while...</span>
                      <button
                        type="button"
                        onClick={() => skipToManual("user_skipped")}
                        className="font-semibold text-brand"
                      >
                        Skip to manual entry
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(activeTab === "manual" || hasFetchedPreview) && (
                <>
                  {activeTab === "url" && hasFetchedPreview && (
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                      <p className="text-xs text-muted">
                        Auto-filled from {hostnameOf(watchedProductUrl || "")}. Review and
                        edit below.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setHasFetchedPreview(false);
                          setScrapeError(null);
                           form.setValue("title", "");
                          form.setValue("image_url", null);
                          form.setValue("price", null);
                          form.setValue("scraped_currency", null);
                        }}
                        className="shrink-0 pl-3 text-xs font-semibold text-brand"
                      >
                        Start over
                      </button>
                    </div>
                  )}

                  {activeTab === "manual" && scrapeError && (
                    <p className="mt-4 text-xs font-medium text-brand">{scrapeError}</p>
                  )}

                  {activeTab === "manual" && (
                    <label className="mt-4 block">
                      <span className="sr-only">Product URL</span>
                      <Input
                        type="url"
                        {...form.register("product_url")}
                        placeholder="Product URL"
                        className="h-[52px] rounded-xl border-[#c9d5e5] px-4 text-sm placeholder:text-[#cbd6e6]"
                      />
                      {form.formState.errors.product_url && (
                        <span className="mt-1 block text-xs font-medium text-brand">
                          {form.formState.errors.product_url.message}
                        </span>
                      )}
                    </label>
                  )}

                  <label className="mt-4 block">
                    <span className="sr-only">Name</span>
                    <Input
                      {...form.register("title")}
                      placeholder="Name"
                      className="h-[52px] rounded-xl border-[#c9d5e5] px-4 text-sm placeholder:text-[#cbd6e6]"
                    />
                    {form.formState.errors.title && (
                      <span className="mt-1 block text-xs font-medium text-brand">
                        {form.formState.errors.title.message}
                      </span>
                    )}
                  </label>

                  <div className="mt-8">
                    <p className="text-sm text-ink">Upload a picture</p>
                    <div className="mt-2 rounded-xl border border-dashed border-[#c9d5e5] bg-white p-4">
                      <input
                        id="wishlist-screen-image-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="wishlist-screen-image-upload"
                        className="flex min-h-[68px] cursor-pointer flex-col items-center justify-center text-center"
                      >
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt=""
                            className="h-16 w-16 rounded-xl object-cover"
                          />
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-ink" strokeWidth={1.7} />
                            <span className="mt-2 text-sm text-[#a9a9a9]">
                              Click <span className="font-semibold text-brand">here</span> to
                              upload a picture
                            </span>
                          </>
                        )}
                        {isUploading && (
                          <span className="mt-2 text-xs font-medium text-muted">
                            Uploading...
                          </span>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="mt-9 inline-flex h-10 w-[138px] items-center justify-between rounded-lg border border-stone-200 bg-white px-5">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity((current) => Math.max(0, current - 1))}
                      className="flex h-8 w-8 items-center justify-center text-[#9b4100]"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-base font-bold text-ink">{quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity((current) => current + 1)}
                      className="flex h-8 w-8 items-center justify-center text-[#9b4100]"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <label className="mt-5 block">
                    <span className="sr-only">Price</span>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      {...form.register("price", {
                        setValueAs: (value) =>
                          value === "" ? null : Number.parseFloat(String(value)),
                      })}
                      placeholder="Price"
                      className="h-[52px] rounded-xl border-[#c9d5e5] px-4 text-sm placeholder:text-[#cbd6e6]"
                    />
                    {isForeignCurrency && (
                      <span className="mt-1 block text-xs font-medium text-amber-600">
                        ⚠ Scraped price may be in a foreign currency ({watchedCurrency}) — verify
                        before saving.
                      </span>
                    )}
                  </label>

                  <label className="mt-4 block">
                    <span className="sr-only">Description</span>
                    <Textarea
                      {...form.register("description")}
                      maxLength={500}
                      placeholder="Description"
                      className="min-h-[116px] rounded-xl border-[#c9d5e5] px-4 py-4 text-sm placeholder:text-[#cbd6e6]"
                    />
                  </label>

                  <div className="mt-5">
                    <p className="text-sm text-ink">Allow Group payment</p>
                    <div className="mt-3 flex items-start gap-4">
                      <button
                        type="button"
                        aria-pressed={allowGroupPayment}
                        onClick={() => setAllowGroupPayment((current) => !current)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand text-white"
                      >
                        {allowGroupPayment && <Check className="h-5 w-5" strokeWidth={3} />}
                      </button>
                      <p className="max-w-[280px] text-sm leading-5 text-muted">
                        This allows multiple people to contribute to this wish
                      </p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    fullWidth
                    disabled={form.formState.isSubmitting || isUploading}
                    className="mt-6 h-[54px] rounded-2xl text-base font-medium"
                  >
                    {form.formState.isSubmitting ? "Saving..." : "Save"}
                  </Button>
                </>
              )}
            </form>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(duplicateItem)} onOpenChange={() => setDuplicateItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This might already be on your list</DialogTitle>
            <DialogDescription>
              {duplicateItem?.title ? `"${duplicateItem.title}" is already saved.` : ""}
              Add it anyway?
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" onClick={() => setDuplicateItem(null)}>
              No
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (pendingSave) {
                  void saveItem(pendingSave, true);
                }
                setDuplicateItem(null);
              }}
            >
              Add anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
