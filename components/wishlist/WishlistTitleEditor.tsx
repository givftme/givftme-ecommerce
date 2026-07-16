"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function WishlistTitleEditor({
  wishlistId,
  initialTitle,
  className,
  textClassName,
  center = false,
}: {
  wishlistId: string;
  initialTitle: string;
  className?: string;
  textClassName?: string;
  center?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [draft, setDraft] = useState(initialTitle);
  const [isSaving, setIsSaving] = useState(false);

  const saveTitle = async () => {
    const nextTitle = draft.trim();

    if (!nextTitle) {
      toast({ title: "Title cannot be empty.", variant: "danger" });
      setDraft(title);
      setIsEditing(false);
      return;
    }

    if (nextTitle === title) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/wishlists/${wishlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });

      if (!response.ok) {
        throw new Error("Failed to update title.");
      }

      setTitle(nextTitle);
      setDraft(nextTitle);
      setIsEditing(false);
      trackEvent("wishlist.title.updated");
      toast({ title: "Wishlist title updated.", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Couldn't update title.", variant: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void saveTitle();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setDraft(title);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className={cn("w-full", className)}>
        <Input
          autoFocus
          value={draft}
          disabled={isSaving}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={handleKeyDown}
          className={cn(center && "text-center", textClassName)}
        />
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className={cn(
        "group inline-flex min-w-0 items-center gap-2 rounded-xl text-left transition-colors hover:text-brand",
        center && "justify-center text-center",
        className
      )}
    >
      <span className={cn("truncate", textClassName)}>{title}</span>
      <Pencil className="h-4 w-4 shrink-0 text-muted transition-colors group-hover:text-brand" />
    </button>
  );
}
