"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Globe, Loader2, Lock, Trash2, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";
import { Button } from "@/components/ui/Button";
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { getInitials } from "@/lib/wishlist/display";
import type { WishlistInvite, WishlistVisibility } from "@/lib/wishlist/types";
import { inviteWishlistViewerSchema } from "@/lib/wishlist/validation";
import { cn } from "@/lib/utils";

const inviteContactSchema = z.object({
  contact: z.string().trim().min(1, "Enter an email or phone number"),
});

type InviteContactValues = z.infer<typeof inviteContactSchema>;

const visibilityOptions: Array<{
  value: WishlistVisibility;
  icon: typeof Lock;
  label: string;
  subtext: string;
}> = [
  {
    value: "private",
    icon: Lock,
    label: "Private",
    subtext: "Only you",
  },
  {
    value: "friends_family",
    icon: Users,
    label: "Friends & Family",
    subtext: "Only people you invite",
  },
  {
    value: "public",
    icon: Globe,
    label: "Public",
    subtext: "Anyone with the link",
  },
];

function truncateMiddle(value: string) {
  if (value.length <= 42) {
    return value;
  }

  return `${value.slice(0, 22)}...${value.slice(-14)}`;
}

function inviteContact(invite: WishlistInvite) {
  return invite.invitee_email || invite.invitee_phone || "Invite";
}

export function ShareSettingsSheet({
  open,
  onOpenChange,
  wishlistId,
  initialVisibility,
  initialPricesVisible,
  occasionTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wishlistId: string;
  initialVisibility: WishlistVisibility;
  initialPricesVisible: boolean;
  occasionTitle?: string | null;
}) {
  const { toast } = useToast();
  const [visibility, setVisibility] =
    useState<WishlistVisibility>(initialVisibility);
  const [pricesVisible, setPricesVisible] = useState(initialPricesVisible);
  const [invites, setInvites] = useState<WishlistInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [removingInviteId, setRemovingInviteId] = useState<string | null>(null);
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const form = useForm<InviteContactValues>({
    resolver: zodResolver(inviteContactSchema),
    defaultValues: { contact: "" },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    trackEvent("wishlist.share_settings.opened", { wishlist_id: wishlistId });
    let cancelled = false;

    async function loadInvites() {
      setLoadingInvites(true);

      try {
        const response = await fetch(`/api/wishlists/${wishlistId}/invites`);

        if (!response.ok) {
          throw new Error("Invite load failed.");
        }

        const payload = (await response.json()) as { invites?: WishlistInvite[] };

        if (!cancelled) {
          setInvites(payload.invites || []);
        }
      } catch {
        if (!cancelled) {
          toast({ title: "Couldn't load invites.", variant: "danger" });
        }
      } finally {
        if (!cancelled) {
          setLoadingInvites(false);
        }
      }
    }

    void loadInvites();

    return () => {
      cancelled = true;
    };
  }, [open, toast, wishlistId]);

  const shareUrl = useMemo(() => {
    if (!origin || visibility === "private") {
      return "";
    }

    if (visibility === "public") {
      return `${origin}/w/${wishlistId}`;
    }

    // Friends-and-family URLs are invite-specific; no token exists until at
    // least one person has been invited.
    const firstInvite = invites[0];
    return firstInvite ? `${origin}/w/${firstInvite.token}` : "";
  }, [invites, origin, visibility, wishlistId]);

  const whatsappHref = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(
        `Hey! I've created a wishlist for my ${occasionTitle || "wishlist"} - here's the link: ${shareUrl}`
      )}`
    : "";

  const patchWishlist = async (
    update: Partial<{
      visibility: WishlistVisibility;
      prices_visible: boolean;
    }>
  ) => {
    const response = await fetch(`/api/wishlists/${wishlistId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });

    if (!response.ok) {
      throw new Error("Wishlist update failed.");
    }
  };

  const changeVisibility = async (nextVisibility: WishlistVisibility) => {
    if (nextVisibility === visibility) {
      return;
    }

    const previous = visibility;
    setVisibility(nextVisibility);

    try {
      await patchWishlist({ visibility: nextVisibility });
      trackEvent("wishlist.visibility.changed", {
        from: previous,
        to: nextVisibility,
      });
    } catch {
      setVisibility(previous);
      toast({ title: "Couldn't update visibility.", variant: "danger" });
    }
  };

  const togglePrices = async (next: boolean) => {
    const previous = pricesVisible;
    setPricesVisible(next);

    try {
      await patchWishlist({ prices_visible: next });
      trackEvent("wishlist.prices_visible.toggled", { now_visible: next });
    } catch {
      setPricesVisible(previous);
      toast({ title: "Couldn't update price visibility.", variant: "danger" });
    }
  };

  const sendInvite = async (values: InviteContactValues) => {
    const contact = values.contact.trim();
    const payload = contact.includes("@")
      ? { invitee_email: contact }
      : { invitee_phone: contact };
    const parsed = inviteWishlistViewerSchema.safeParse(payload);

    if (!parsed.success) {
      form.setError("contact", {
        message: parsed.error.issues[0]?.message || "Enter a valid invite.",
      });
      return;
    }

    const response = await fetch(`/api/wishlists/${wishlistId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const result = (await response.json()) as {
      invite?: WishlistInvite;
      error?: string;
    };

    if (!response.ok || !result.invite) {
      form.setError("contact", {
        message: result.error || "Couldn't send invite.",
      });
      return;
    }

    setInvites((current) => [...current, result.invite!]);
    form.reset({ contact: "" });
    trackEvent("wishlist.invite.sent", {
      method: parsed.data.invitee_email ? "email" : "phone",
    });
    toast({ title: "Invite sent.", variant: "success" });
  };

  const removeInvite = async (inviteId: string) => {
    setRemovingInviteId(inviteId);

    try {
      const response = await fetch(
        `/api/wishlists/${wishlistId}/invites/${inviteId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Remove failed.");
      }

      setInvites((current) => current.filter((invite) => invite.id !== inviteId));
      trackEvent("wishlist.invite.revoked");
    } catch {
      toast({ title: "Couldn't remove invite.", variant: "danger" });
    } finally {
      setRemovingInviteId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-h-[92dvh] overflow-y-auto md:bottom-auto md:top-1/2 md:max-w-lg md:-translate-y-1/2 md:rounded-2xl">
        <SheetHeader>
          <SheetTitle>Share your wishlist</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-7">
          <section>
            <h2 className="text-sm font-semibold text-ink">Who can see this?</h2>
            <div className="mt-3 space-y-3">
              {visibilityOptions.map((option) => {
                const Icon = option.icon;
                const selected = visibility === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => void changeVisibility(option.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left transition-colors",
                      selected
                        ? "border-brand bg-brand-light"
                        : "border-stone-100 hover:border-brand/40 hover:bg-brand-light"
                    )}
                  >
                    <Icon className="h-5 w-5 text-brand" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">
                        {option.label}
                      </span>
                      <span className="block text-xs text-muted">
                        {option.subtext}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">Show prices?</h2>
              <p className="mt-1 text-xs text-muted">Show prices to viewers</p>
            </div>
            <Switch checked={pricesVisible} onCheckedChange={togglePrices} />
          </section>

          {visibility === "friends_family" && (
            <section>
              <h2 className="text-sm font-semibold text-ink">Invite people</h2>
              <Form {...form}>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={form.handleSubmit(sendInvite)}
                >
                  <FormField
                    control={form.control}
                    name="contact"
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1">
                        <Input
                          placeholder="Email address or phone number"
                          autoComplete="off"
                          {...field}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Send invite
                  </Button>
                </form>
              </Form>

              <div className="mt-4 space-y-2">
                {loadingInvites ? (
                  <p className="text-sm text-muted">Loading invites...</p>
                ) : invites.length === 0 ? (
                  <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
                    No one invited yet
                  </p>
                ) : (
                  invites.map((invite) => {
                    const contact = inviteContact(invite);
                    const accepted = Boolean(invite.invitee_user_id || invite.accepted_at);

                    return (
                      <div
                        key={invite.id}
                        className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-white p-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">
                          {getInitials(contact)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">
                            {contact}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                accepted ? "bg-green-500" : "bg-stone-300"
                              )}
                            />
                            {accepted ? "Accepted" : "Pending"}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={removingInviteId === invite.id}
                          onClick={() => void removeInvite(invite.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove invite</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-ink">Share link</h2>
            <div className="mt-3 rounded-2xl bg-surface p-4">
              <p className="text-sm font-medium text-ink">
                {shareUrl
                  ? truncateMiddle(shareUrl)
                  : visibility === "friends_family"
                    ? "Invite someone to generate their private link."
                    : "Set this wishlist to public to create a share link."}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <CopyLinkButton value={shareUrl} disabled={!shareUrl} />
              <a
                href={whatsappHref || undefined}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex h-11 items-center justify-center rounded-full border-[1.5px] border-brand px-6 text-sm font-medium text-brand transition-colors hover:bg-brand-light",
                  !shareUrl && "pointer-events-none opacity-50"
                )}
              >
                WhatsApp
              </a>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
