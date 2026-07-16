"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { AddItemSheet } from "@/components/wishlist/AddItemSheet";
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
import { CreateOccasionStepper } from "@/components/occasion/CreateOccasionStepper";
import { OccasionTypeSelector } from "@/components/occasion/OccasionTypeSelector";
import { PullFromEvergreen } from "@/components/occasion/PullFromEvergreen";
import {
  OCCASION_TITLE_SUGGESTIONS,
} from "@/lib/occasion/constants";
import { isPastDateOnly } from "@/lib/occasion/date";
import type { MasterItem, OccasionType } from "@/lib/occasion/types";
import {
  occasionBasicsSchema,
  type OccasionBasics,
  type OccasionBasicsInput,
} from "@/lib/occasion/validation";
import { trackEvent } from "@/lib/analytics";
import { formatWishlistPrice } from "@/lib/wishlist/display";
import type { WishlistItem } from "@/lib/wishlist/types";

gsap.registerPlugin(useGSAP);

function draftToExclusivePayload(item: WishlistItem) {
  return {
    origin: "external" as const,
    title: item.title,
    product_url: item.product_url || "",
    image_url: item.image_storage_path || item.image_url,
    price: item.price,
    description: item.description,
    scraped_currency: null,
    is_exclusive: true,
  };
}

function ExclusiveDraftCard({
  item,
  onRemove,
}: {
  item: WishlistItem;
  onRemove: (id: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="h-14 w-14 shrink-0 rounded-xl bg-surface" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-ink">{item.title}</h3>
          <p className="mt-1 text-xs font-semibold text-ink">
            {formatWishlistPrice(item.price)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Remove item"
          onClick={() => onRemove(item.id)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export function CreateOccasionForm({
  evergreenItems,
  initialStep,
}: {
  evergreenItems: MasterItem[];
  initialStep: 1 | 2 | 3;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const stepRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [direction, setDirection] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [exclusiveItems, setExclusiveItems] = useState<WishlistItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [pastWarningOpen, setPastWarningOpen] = useState(false);
  const [lastSuggestion, setLastSuggestion] = useState("");
  const [creating, setCreating] = useState(false);

  const form = useForm<OccasionBasicsInput, unknown, OccasionBasics>({
    resolver: zodResolver(occasionBasicsSchema),
    defaultValues: {
      title: "",
      occasion_type: undefined,
      occasion_date: "",
    },
  });

  const selectedType = useWatch({
    control: form.control,
    name: "occasion_type",
  }) as OccasionType | undefined;

  useGSAP(
    () => {
      if (!stepRef.current) {
        return;
      }

      gsap.fromTo(
        stepRef.current,
        { x: direction > 0 ? 32 : -32, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.3, ease: "power2.inOut" }
      );
    },
    { scope: stepRef, dependencies: [step] }
  );

  const header = useMemo(() => {
    if (step === 1) {
      return {
        title: "Create an occasion",
        subtext: "What are you celebrating?",
      };
    }

    if (step === 2) {
      return {
        title: "Add from your wishlist",
        subtext: "Pick things from your main wishlist to include",
      };
    }

    return {
      title: "Add occasion-only items",
      subtext: "These won't appear on your main wishlist",
    };
  }, [step]);

  const goToStep = (nextStep: 1 | 2 | 3) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
    router.push(nextStep === 1 ? "/dashboard/occasions/new" : `/dashboard/occasions/new?step=${nextStep}`);
  };

  const hasEnteredData =
    form.formState.isDirty || selectedIds.length > 0 || exclusiveItems.length > 0;

  const handleBack = () => {
    if (step === 1) {
      if (!hasEnteredData || window.confirm("Discard this occasion draft?")) {
        router.push("/dashboard/wishlists");
      }
      return;
    }

    goToStep((step - 1) as 1 | 2);
  };

  const handleTypeChange = (type: OccasionType) => {
    form.setValue("occasion_type", type, { shouldDirty: true, shouldValidate: true });
    const currentTitle = form.getValues("title");
    const suggestion = OCCASION_TITLE_SUGGESTIONS[type];

    if (!currentTitle || currentTitle === lastSuggestion) {
      form.setValue("title", suggestion, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setLastSuggestion(suggestion);
    }
  };

  const validateStepOne = async () => {
    if (!form.getValues("occasion_type")) {
      form.setError("occasion_type", {
        type: "manual",
        message: "Select an occasion type",
      });
    }

    const valid = await form.trigger(["occasion_type", "title", "occasion_date"]);

    if (!valid) {
      return;
    }

    if (isPastDateOnly(form.getValues("occasion_date"))) {
      setPastWarningOpen(true);
      return;
    }

    goToStep(2);
  };

  const createOccasion = async () => {
    const parsed = occasionBasicsSchema.safeParse(form.getValues());

    if (!parsed.success) {
      await validateStepOne();
      return;
    }

    setCreating(true);

    try {
      const response = await fetch("/api/occasions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          pulled_item_ids: selectedIds,
          exclusive_items: exclusiveItems.map(draftToExclusivePayload),
        }),
      });
      const payload = (await response.json()) as {
        occasion_id?: string;
        error?: string;
      };

      if (!response.ok || !payload.occasion_id) {
        throw new Error(payload.error || "Couldn't create occasion.");
      }

      trackEvent("occasion.created", {
        occasion_type: parsed.data.occasion_type,
        pulled_count: selectedIds.length,
        exclusive_count: exclusiveItems.length,
      });
      router.push(
        `/dashboard/occasions/${payload.occasion_id}?created=1&type=${parsed.data.occasion_type}`
      );
    } catch {
      toast({ title: "Couldn't create occasion. Try again.", variant: "danger" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-dvh bg-surface pb-24 md:pb-10">
      <div className="mx-auto min-h-dvh max-w-2xl bg-white px-4 py-5 md:mt-6 md:min-h-0 md:rounded-2xl md:border md:border-stone-100 md:p-8 md:shadow-sm">
        <header>
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
            <button
              type="button"
              aria-label="Go back"
              onClick={handleBack}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand-light hover:text-brand"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <CreateOccasionStepper step={step} />
            <Link
              href="/dashboard/wishlists"
              className="text-right text-sm font-medium text-muted hover:text-ink"
            >
              Exit
            </Link>
          </div>

          <h1 className="mt-8 text-2xl font-bold text-ink">{header.title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{header.subtext}</p>
        </header>

        <div ref={stepRef} className="mt-7">
          {step === 1 && (
            <section className="space-y-6">
              <div>
                <OccasionTypeSelector value={selectedType} onChange={handleTypeChange} />
                {form.formState.errors.occasion_type && (
                  <p className="mt-2 text-xs font-medium text-brand">
                    {form.formState.errors.occasion_type.message ||
                      "Select an occasion type"}
                  </p>
                )}
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-medium text-ink">Occasion title</span>
                <Input
                  {...form.register("title")}
                  maxLength={100}
                  placeholder="e.g. My 30th Birthday"
                />
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

              <Button type="button" fullWidth onClick={() => void validateStepOne()}>
                Next
              </Button>
            </section>
          )}

          {step === 2 && (
            <section className="pb-24">
              <PullFromEvergreen
                items={evergreenItems}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                emptyAction={
                  <Button type="button" variant="ghost" onClick={() => goToStep(3)}>
                    Skip
                  </Button>
                }
              />
              <div className="sticky bottom-0 mt-6 rounded-2xl border border-stone-100 bg-white p-4 shadow-lg">
                <p className="text-center text-sm font-medium text-muted">
                  {selectedIds.length} {selectedIds.length === 1 ? "item" : "items"} selected
                </p>
                <Button type="button" fullWidth className="mt-3" onClick={() => goToStep(3)}>
                  Next
                </Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="pb-28">
              {exclusiveItems.length > 0 ? (
                <div className="space-y-3">
                  {exclusiveItems.map((item) => (
                    <ExclusiveDraftCard
                      key={item.id}
                      item={item}
                      onRemove={(id) =>
                        setExclusiveItems((current) =>
                          current.filter((draft) => draft.id !== id)
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-stone-100 bg-white px-4 py-8 text-center shadow-sm">
                  <p className="text-sm leading-6 text-muted">
                    Add special items for this occasion, or create it with only your main wishlist picks.
                  </p>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                fullWidth
                className="mt-4"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add item
              </Button>

              <div className="sticky bottom-0 mt-6 rounded-2xl border border-stone-100 bg-white p-4 shadow-lg">
                <p className="text-center text-sm font-medium text-muted">
                  {selectedIds.length} from your wishlist&nbsp; • &nbsp;
                  {exclusiveItems.length} exclusive{" "}
                  {exclusiveItems.length === 1 ? "item" : "items"}
                </p>
                <Button
                  type="button"
                  fullWidth
                  className="mt-3"
                  disabled={creating}
                  onClick={() => void createOccasion()}
                >
                  {creating ? "Creating..." : "Create occasion"}
                </Button>
              </div>
            </section>
          )}
        </div>
      </div>

      <AddItemSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        existingItems={exclusiveItems}
        onItemAdded={(item) => setExclusiveItems((current) => [...current, item])}
        isExclusive
        draftMode
      />

      <Dialog open={pastWarningOpen} onOpenChange={setPastWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This date has passed</DialogTitle>
            <DialogDescription>
              Create anyway? You can still build the wishlist, but countdowns will show it as past.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="ghost" onClick={() => setPastWarningOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setPastWarningOpen(false);
                goToStep(2);
              }}
            >
              Create anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
