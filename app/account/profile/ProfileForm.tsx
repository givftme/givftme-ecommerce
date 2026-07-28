"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  DEFAULT_THANK_YOU_MESSAGE_PLACEHOLDER,
  profileSchema,
  type ProfileFormValues,
} from "@/lib/account/validation";
import { removeAvatar, uploadAvatar } from "@/app/account/profile/avatar";
import { DeleteAccountDialog } from "@/app/account/profile/DeleteAccountDialog";

const ADD_NAME_BANNER_DISMISSED_KEY = "profile_add_name_banner_dismissed";
const THANK_YOU_MAX_LENGTH = 500;

interface ProfileFormProps {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  defaultThankYouMsg: string | null;
}

export function ProfileForm({
  userId,
  email,
  fullName,
  avatarUrl,
  phone,
  defaultThankYouMsg,
}: ProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const [isAvatarBusy, setIsAvatarBusy] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showAddNameBanner, setShowAddNameBanner] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: fullName ?? "",
      phone: phone ?? "",
      default_thank_you_msg: defaultThankYouMsg ?? "",
    },
  });

  const watchedFullName = useWatch({ control: form.control, name: "full_name" });
  const watchedThankYouMsg = useWatch({
    control: form.control,
    name: "default_thank_you_msg",
  });
  const thankYouLength = (watchedThankYouMsg ?? "").length;

  useEffect(() => {
    if (fullName) {
      return;
    }

    // Reads a browser-only API (localStorage) to sync banner visibility after
    // mount — must run client-side, so an effect (not a lazy initializer) is
    // required to avoid an SSR/hydration mismatch.
    const dismissed = window.localStorage.getItem(ADD_NAME_BANNER_DISMISSED_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowAddNameBanner(dismissed !== "true");
  }, [fullName]);

  const dismissBanner = () => {
    window.localStorage.setItem(ADD_NAME_BANNER_DISMISSED_KEY, "true");
    setShowAddNameBanner(false);
  };

  const initials = (watchedFullName || "").trim().charAt(0).toUpperCase() || "?";

  const handleAvatarSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsAvatarBusy(true);

    try {
      const publicUrl = await uploadAvatar(file, userId);
      setCurrentAvatarUrl(publicUrl);
      trackEvent("profile.avatar_uploaded");
      toast({ title: "Profile photo updated.", variant: "success" });
      router.refresh();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Upload failed. Please try again.",
        variant: "danger",
      });
    } finally {
      setIsAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentAvatarUrl) {
      return;
    }

    setIsAvatarBusy(true);

    try {
      await removeAvatar(currentAvatarUrl, userId);
      setCurrentAvatarUrl(null);
      trackEvent("profile.avatar_removed");
      toast({ title: "Profile photo removed.", variant: "success" });
      router.refresh();
    } catch (error) {
      toast({
        title:
          error instanceof Error ? error.message : "Couldn't remove photo. Please try again.",
        variant: "danger",
      });
    } finally {
      setIsAvatarBusy(false);
    }
  };

  const onSubmit = async (values: ProfileFormValues) => {
    const fieldsChanged = Object.keys(form.formState.dirtyFields);

    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({
        full_name: values.full_name,
        phone: values.phone || null,
        default_thank_you_msg: values.default_thank_you_msg || null,
      })
      .eq("id", userId);

    if (error) {
      toast({ title: "Couldn't save your changes. Please try again.", variant: "danger" });
      return;
    }

    trackEvent("profile.updated", { fields_changed: fieldsChanged.join(",") });
    toast({ title: "Changes saved.", variant: "success" });
    form.reset(values);
    setShowAddNameBanner(false);
    router.refresh();
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    trackEvent("auth.signed_out");
    router.push("/");
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {showAddNameBanner && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            Add your name so friends know whose wishlist they&apos;re viewing.
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissBanner}
            className="shrink-0 text-amber-700 hover:text-amber-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAvatarBusy}
          aria-label="Change profile photo"
          className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light text-2xl font-semibold text-brand"
        >
          {currentAvatarUrl ? (
            <img src={currentAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
          {isAvatarBusy && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </span>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatarSelect}
          className="hidden"
        />
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAvatarBusy}
          >
            Change photo
          </Button>
          {currentAvatarUrl && (
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={isAvatarBusy}
              className="text-muted"
            >
              Remove photo
            </Button>
          )}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <Input {...field} placeholder="Your full name" />
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <label htmlFor="profile-email" className="text-xs font-medium text-ink">
              Email
            </label>
            <Input id="profile-email" value={email} disabled readOnly />
          </div>

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <Input {...field} type="tel" placeholder="+234 800 000 0000" />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="default_thank_you_msg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default thank-you message</FormLabel>
                <Textarea
                  {...field}
                  rows={4}
                  maxLength={THANK_YOU_MAX_LENGTH}
                  placeholder={DEFAULT_THANK_YOU_MESSAGE_PLACEHOLDER}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">
                    This is sent automatically to anyone who buys you a gift.
                  </p>
                  <span className="shrink-0 text-xs text-muted">
                    {thankYouLength}/{THANK_YOU_MAX_LENGTH}
                  </span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            fullWidth
            className="md:w-auto"
            disabled={!form.formState.isDirty || form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </form>
      </Form>

      <div className="border-t border-stone-200 pt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Danger zone
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            Sign out
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDeleteDialogOpen(true)}
            className={cn("border-red-200 text-red-600 hover:bg-red-50")}
          >
            Delete account
          </Button>
        </div>
      </div>

      <DeleteAccountDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} />
    </div>
  );
}
