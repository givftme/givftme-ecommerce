"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { StarRating } from "@/components/review/StarRating";
import { trackEvent } from "@/lib/analytics";
import {
  REVIEW_BODY_MAX_LENGTH,
  reviewFormSchema,
  type ReviewFormValues,
} from "@/lib/reviews/validation";

interface ExistingReview {
  id: string;
  rating: number;
  body: string | null;
}

export function ReviewForm({
  productId,
  productSlug,
  existingReview,
}: {
  productId: string;
  productSlug: string;
  existingReview: ExistingReview | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = Boolean(existingReview);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      rating: existingReview?.rating || 0,
      body: existingReview?.body || "",
    },
  });

  const rating = useWatch({ control: form.control, name: "rating" }) || 0;
  const body = useWatch({ control: form.control, name: "body" }) || "";

  const goToProduct = () => router.push(`/product/${productSlug}`);

  const save = async (values: ReviewFormValues) => {
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalog_product_id: productId,
          rating: values.rating,
          body: values.body || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        review?: unknown;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "Couldn't submit your review. Please try again.",
        );
      }

      trackEvent(isEditing ? "review.edited" : "review.submitted", {
        rating: values.rating,
        has_body: Boolean(values.body),
      });
      toast({
        title: isEditing ? "Review updated." : "Review submitted.",
        variant: "success",
      });
      router.push(`/product/${productSlug}`);
      router.refresh();
    } catch (error) {
      toast({
        title:
          error instanceof Error
            ? error.message
            : "Couldn't submit your review. Please try again.",
        variant: "danger",
      });
    }
  };

  const deleteReview = async () => {
    if (!existingReview) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/reviews/${existingReview.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed.");
      }

      trackEvent("review.deleted", {});
      toast({ title: "Review deleted.", variant: "success" });
      router.push(`/product/${productSlug}`);
      router.refresh();
    } catch {
      toast({
        title: "Couldn't delete your review. Please try again.",
        variant: "danger",
      });
      setDeleting(false);
    }
  };

  return (
    <>
      <form className="space-y-6" onSubmit={form.handleSubmit(save)}>
        <div className="space-y-2">
          <StarRating
            value={rating}
            onChange={(value) =>
              form.setValue("rating", value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
          />
          <p className="text-sm font-medium text-ink">
            {rating > 0 ? `${rating} out of 5` : "Select a rating"}
          </p>
          {form.formState.errors.rating ? (
            <p className="text-xs font-medium text-red-600">
              {form.formState.errors.rating.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Textarea
            {...form.register("body")}
            placeholder="Share your experience with this product…"
            maxLength={REVIEW_BODY_MAX_LENGTH}
            rows={5}
          />
          <p className="text-right text-xs text-muted">
            {body.length}/{REVIEW_BODY_MAX_LENGTH}
          </p>
          {form.formState.errors.body ? (
            <p className="text-xs font-medium text-red-600">
              {form.formState.errors.body.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <Button
            type="submit"
            fullWidth
            size="lg"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? "Submitting..."
              : isEditing
                ? "Update review"
                : "Submit review"}
          </Button>
          <Button type="button" fullWidth variant="ghost" onClick={goToProduct}>
            Cancel
          </Button>
        </div>

        {isEditing ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="block w-full border-t border-stone-100 pt-4 text-center text-sm font-medium text-red-600 hover:text-red-700"
          >
            Delete review
          </button>
        ) : null}
      </form>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this review?</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={() => void deleteReview()}
            >
              {deleting ? "Deleting..." : "Delete review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
