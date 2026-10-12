"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Loader2, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/Form";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import {
  DEFAULT_THANK_YOU_MESSAGE_PLACEHOLDER,
  profileSchema,
  type ProfileFormValues,
} from "@/lib/account/validation";
import { removeAvatar, uploadAvatar } from "@/app/account/profile/avatar";
import {
  requestEmailChangeAction,
  updateProfileAction,
} from "@/app/account/profile/actions";
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";
import { SignOutButton } from "@/components/account/SignOutButton";
import { getAccountAvatarColor } from "@/components/account/AccountAvatar";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ADD_NAME_BANNER_DISMISSED_KEY = "profile_add_name_banner_dismissed";
const THANK_YOU_MAX_LENGTH = 300;

interface ProfileFormProps {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  defaultThankYouMsg: string | null;
  birthday: string | null;
}

export function ProfileForm({
  userId,
  email,
  fullName,
  avatarUrl,
  phone,
  defaultThankYouMsg,
  birthday,
}: ProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarPreviewRef = useRef<HTMLButtonElement>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);
  const [isAvatarBusy, setIsAvatarBusy] = useState(false);
  const [showAddNameBanner, setShowAddNameBanner] = useState(false);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailNotice, setEmailNotice] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

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

  useGSAP(() => {
    if (!currentAvatarUrl) return;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(avatarPreviewRef.current, { scale: 0.9, autoAlpha: 0, duration: 0.3, ease: "back.out(1.5)" });
    });
    return () => media.revert();
  }, { dependencies: [currentAvatarUrl], revertOnUpdate: true });

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
      trackEvent("account.avatar.uploaded");
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
      trackEvent("account.avatar.removed");
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
    try {
      const result = await updateProfileAction(values);
      if (!result.success) {
        toast({ title: "Couldn't save changes. Try again.", variant: "danger" });
        return;
      }

      trackEvent("account.profile.updated", { fields_changed: fieldsChanged });
      toast({ title: "Changes saved.", variant: "success" });
      form.reset(values);
      setShowAddNameBanner(false);
      router.refresh();
    } catch {
      toast({ title: "Couldn't save changes. Try again.", variant: "danger" });
    }
  };

  const onRequestEmailChange = async () => {
    setEmailNotice("");
    setEmailBusy(true);
    try {
      const result = await requestEmailChangeAction(newEmail);
      if (!result.success) {
        setEmailNotice(result.error);
        return;
      }
      setEmailNotice(`Confirmation sent to ${newEmail.trim()} — check your inbox.`);
      setNewEmail("");
      setIsChangingEmail(false);
    } catch {
      setEmailNotice("Couldn't request an email change. Try again.");
    } finally {
      setEmailBusy(false);
    }
  };


  return (
    <div className="max-w-[560px] space-y-8">
      {showAddNameBanner && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm text-warning">
            Add your name so friends know whose wishlist they&apos;re viewing.
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissBanner}
            className="shrink-0 text-warning hover:text-warning"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col items-center gap-3 text-center">
        <button
          ref={avatarPreviewRef}
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAvatarBusy}
          aria-label="Change profile photo"
          className={cn("relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full text-2xl font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand", currentAvatarUrl ? "bg-surface" : getAccountAvatarColor(userId))}
        >
          {currentAvatarUrl ? (
            <img src={currentAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
          {isAvatarBusy && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span aria-label="Uploading photo" role="status" className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/50 border-t-white" />
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
        <div className="min-w-0 space-y-1">
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAvatarBusy} className="min-h-11 text-sm font-semibold text-brand hover:underline disabled:opacity-50">Change photo</button>
          {currentAvatarUrl && <button type="button" onClick={handleRemoveAvatar} disabled={isAvatarBusy} className="block min-h-9 w-full text-xs text-muted hover:underline disabled:opacity-50">Remove photo</button>}
          <p className="text-xs leading-5 text-muted">JPEG, PNG or WebP, up to 5MB</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 border-t border-line pt-8">
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
              Email address
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Input id="profile-email" value={email} disabled readOnly className="min-w-56 flex-1" />
              <button
                type="button"
                onClick={() => { setIsChangingEmail((current) => !current); setEmailNotice(""); }}
                className="min-h-11 text-sm font-semibold text-brand hover:underline"
              >
                {isChangingEmail ? "Cancel" : "Change email"}
              </button>
            </div>
            {isChangingEmail && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="New email address"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
                <Button type="button" onClick={onRequestEmailChange} disabled={emailBusy || !newEmail.trim()}>
                  {emailBusy ? "Sending…" : "Send confirmation"}
                </Button>
              </div>
            )}
            {emailNotice && <p role="status" className="text-sm text-muted">{emailNotice}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-ink">Password</p>
              <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line px-4">
                <span className="text-sm text-muted">••••••••</span>
                <Link href="/forgot-password" className="text-sm font-semibold text-brand hover:underline">Change password</Link>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-ink">Birthday</p>
              <div className="flex min-h-12 items-center rounded-xl border border-line px-4 text-sm text-muted">
                {birthday || "Not provided"}
              </div>
            </div>
          </div>

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <Input {...field} type="tel" placeholder="08012345678" />
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
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-muted">
                    This message is sent automatically to anyone who buys you a gift.
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
      <section className="space-y-4 border-t border-line pt-8" aria-labelledby="profile-danger-zone">
        <div>
          <h2 id="profile-danger-zone" className="text-base font-semibold text-ink">Danger zone</h2>
          <p className="mt-1 text-sm text-muted">Sign out on this device or permanently delete your account.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <SignOutButton />
          <DeleteAccountDialog />
        </div>
      </section>
    </div>
  );
}
