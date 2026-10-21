"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, MailCheck } from "lucide-react";
import { Field, Select } from "@/components/business-dashboard/BizUi";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RESEND_COOLDOWN_SECONDS, resendFailure } from "@/lib/auth/resend";
import { emailSchema } from "@/lib/auth/validation";
import { BUSINESS_CONTACT_HREF, BUSINESS_DASHBOARD_HREF } from "@/lib/business/entry";
import { AUTH_FEATURES, SIGNUP_ROLES } from "@/lib/business-dashboard/data";
import {
  businessSignInSchema,
  businessSignUpSchema,
  type BusinessSignInValues,
  type BusinessSignUpValues,
} from "@/lib/business-dashboard/validation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Tab = "signin" | "create";

async function post(path: string, values: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string; code?: string; redirectTo?: string; needsConfirmation?: boolean }
    | null;
  return { ok: response.ok, body };
}

/**
 * Sends the sign-up confirmation link again, back to the dashboard. Without a
 * known email (an expired link) it asks for one. After a send, or a rate
 * limit, it counts down Supabase's per-address limit before allowing another.
 */
function ResendConfirmation({ email: knownEmail }: { email?: string }) {
  const [email, setEmail] = useState(knownEmail ?? "");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resend = async (event?: FormEvent) => {
    event?.preventDefault();
    const address = email.trim();
    if (!emailSchema.safeParse(address).success) {
      setMessage("Enter the email you signed up with.");
      return;
    }

    setSending(true);
    setMessage("");
    const callback = new URL("/callback", window.location.origin);
    callback.searchParams.set("redirect", BUSINESS_DASHBOARD_HREF);
    try {
      const { error } = await createClient().auth.resend({
        type: "signup",
        email: address,
        options: { emailRedirectTo: callback.toString() },
      });
      if (error) {
        const failure = resendFailure(error);
        setMessage(failure.message);
        if (failure.cooldown) setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setMessage(`A new link is on its way to ${address}.`);
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch {
      setMessage(resendFailure(null).message);
    } finally {
      setSending(false);
    }
  };

  const action = (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type={knownEmail ? "button" : "submit"}
        variant="outline"
        size="sm"
        onClick={knownEmail ? () => void resend() : undefined}
        disabled={sending || cooldown > 0}
      >
        {sending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        {cooldown > 0 ? `Resend again in ${cooldown}s` : "Resend confirmation link"}
      </Button>
      <p role="status" className="text-xs text-muted">
        {message}
      </p>
    </div>
  );

  if (knownEmail) return action;

  return (
    <form onSubmit={resend} noValidate className="flex flex-col gap-3">
      <Field label="Email you signed up with" htmlFor="resend-email">
        <Input
          id="resend-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </Field>
      {action}
    </form>
  );
}

function SignInForm({
  onError,
  onUnconfirmed,
}: {
  onError: (message: string) => void;
  onUnconfirmed: (email: string | null) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BusinessSignInValues>({ resolver: zodResolver(businessSignInSchema) });

  const onSubmit = handleSubmit(async (values) => {
    onError("");
    onUnconfirmed(null);
    try {
      const { ok, body } = await post("/api/business-dashboard/auth/signin", values);
      if (!ok) {
        onError(body?.error || "Something went wrong. Please try again.");
        if (body?.code === "email_not_confirmed") onUnconfirmed(values.email);
        return;
      }
      // A full navigation so the server renders with the new session cookies.
      window.location.assign(body?.redirectTo || BUSINESS_DASHBOARD_HREF);
    } catch {
      onError("Something went wrong. Please try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Work email" htmlFor="signin-email" error={errors.email?.message}>
        <Input id="signin-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="signin-password" error={errors.password?.message}>
        <Input id="signin-password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
      </Field>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-xs font-medium text-brand hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" fullWidth disabled={isSubmitting} className="h-12">
        {isSubmitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        Sign in
      </Button>
    </form>
  );
}

function CreateAccountForm({ onError, onConfirm }: { onError: (message: string) => void; onConfirm: (email: string) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BusinessSignUpValues>({
    resolver: zodResolver(businessSignUpSchema),
    defaultValues: { companyName: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    onError("");
    try {
      const { ok, body } = await post("/api/business-dashboard/auth/signup", values);
      if (!ok) {
        onError(body?.error || "Something went wrong. Please try again.");
        return;
      }
      if (body?.needsConfirmation) {
        onConfirm(values.email);
        return;
      }
      window.location.assign(body?.redirectTo || BUSINESS_DASHBOARD_HREF);
    } catch {
      onError("Something went wrong. Please try again.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Company name" htmlFor="create-company" error={errors.companyName?.message}>
        <Input id="create-company" autoComplete="organization" aria-invalid={Boolean(errors.companyName)} {...register("companyName")} />
      </Field>
      <Field label="Work email" htmlFor="create-email" error={errors.email?.message}>
        <Input id="create-email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register("email")} />
      </Field>
      <Field label="Your role" htmlFor="create-role" error={errors.role?.message}>
        <Select id="create-role" defaultValue="" className="h-12" aria-invalid={Boolean(errors.role)} {...register("role")}>
          <option value="" disabled>Choose one</option>
          {SIGNUP_ROLES.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </Select>
      </Field>
      <Field label="Password" htmlFor="create-password" error={errors.password?.message} hint="At least 8 characters.">
        <Input id="create-password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register("password")} />
      </Field>
      <Button type="submit" fullWidth disabled={isSubmitting} className="h-12">
        {isSubmitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        Create business account
      </Button>
    </form>
  );
}

/** A signed-in login that can't open the dashboard. */
interface SignedIn {
  email: string;
  /** `incomplete`: account type and business membership disagree. */
  state: "personal" | "incomplete";
}

/** Explains the open session and offers to sign it out of this device. */
function SignedInNotice({ email, state }: SignedIn) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    setFailed(false);
    try {
      // This device only: the account stays signed in on the visitor's others.
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      router.refresh();
    } catch {
      setSigningOut(false);
      setFailed(true);
    }
  };

  const who = email ? (
    <>
      You&apos;re signed in as <span className="font-semibold text-ink">{email}</span>
    </>
  ) : (
    <>You&apos;re signed in</>
  );

  return (
    <div className="mb-6 flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
      {state === "personal" ? (
        <p>{who} with a personal account. Business accounts are separate and use their own work email.</p>
      ) : (
        <p>
          {who}, but this login isn&apos;t fully linked to a company account, so the dashboard can&apos;t open.{" "}
          <a href={BUSINESS_CONTACT_HREF} className="font-semibold text-brand underline-offset-4 hover:underline">
            Message our team
          </a>{" "}
          and we&apos;ll restore access, or sign out to use another account.
        </p>
      )}
      <Button variant="outline" size="sm" onClick={signOut} disabled={signingOut}>
        {signingOut ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
        {state === "personal" ? "Sign out of personal account" : "Sign out"}
      </Button>
      {failed ? (
        <p role="alert" className="text-xs text-danger">
          Couldn&apos;t sign you out. Check your connection and try again.
        </p>
      ) : null}
    </div>
  );
}

/** Sign in / Create a business account, with the dark feature panel on desktop. */
export function BizAuthScreen({
  initialTab,
  initialError,
  offerResend,
  signedIn,
}: {
  initialTab: Tab;
  initialError: string | null;
  /** An expired or used confirmation link brought them here. */
  offerResend: boolean;
  signedIn: SignedIn | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [error, setError] = useState(initialError ?? "");
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden flex-col justify-between bg-ink p-12 text-background lg:flex">
        <Link href="/business" className="text-sm font-semibold opacity-80 hover:opacity-100">
          Givftme <span className="font-normal">for Business</span>
        </Link>
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight">Upload your team once. We&apos;ll remember everybody&apos;s day.</h1>
          <ul className="mt-8 flex flex-col gap-4">
            {AUTH_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-base opacity-85">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-white">
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs opacity-60">Corporate gifting for Nigerian teams, in Naira.</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 lg:hidden">
            <Link href="/business" className="text-sm font-semibold text-ink">
              Givftme <span className="font-normal text-muted">for Business</span>
            </Link>
          </div>

          {confirmEmail ? (
            <div className="flex flex-col items-start gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-light text-brand">
                <MailCheck aria-hidden="true" className="h-6 w-6" />
              </span>
              <h2 className="text-2xl font-bold text-ink">Check your email</h2>
              <p className="text-sm text-muted">
                We sent a confirmation link to <span className="font-semibold text-ink">{confirmEmail}</span>. Open it to finish
                setting up your business account.
              </p>
              <ResendConfirmation email={confirmEmail} />
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmEmail(null);
                  setTab("signin");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              {signedIn ? <SignedInNotice {...signedIn} /> : null}
              <h2 className="text-2xl font-bold text-ink">{tab === "signin" ? "Welcome back" : "Set up your company"}</h2>
              <p className="mt-1 text-sm text-muted">
                {tab === "signin" ? "Sign in to your HR dashboard." : "Free to start. Add your team in minutes."}
              </p>

              <div role="tablist" aria-label="Account" className="my-6 grid grid-cols-2 rounded-full bg-surface p-1">
                {(
                  [
                    ["signin", "Sign in"],
                    ["create", "Create a business account"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    onClick={() => {
                      setTab(value);
                      setError("");
                      setUnconfirmedEmail(null);
                    }}
                    className={cn(
                      "rounded-full px-3 py-2 text-xs font-semibold transition-colors sm:text-sm",
                      tab === value ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {error ? (
                <p role="alert" className="mb-4 rounded-xl bg-brand-light px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              ) : null}
              {unconfirmedEmail ? (
                <div className="mb-4">
                  <ResendConfirmation email={unconfirmedEmail} />
                </div>
              ) : offerResend && tab === "signin" ? (
                <div className="mb-6 rounded-2xl border border-line px-4 py-3">
                  <p className="mb-3 text-sm font-semibold text-ink">Need a new confirmation link?</p>
                  <ResendConfirmation />
                </div>
              ) : null}

              {tab === "signin" ? (
                <>
                  <SignInForm onError={setError} onUnconfirmed={setUnconfirmedEmail} />
                  <div className="my-5 flex items-center gap-3 text-xs text-muted">
                    <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
                  </div>
                  <GoogleOAuthButton
                    label="Continue with Google"
                    flow="login"
                    redirectTo={BUSINESS_DASHBOARD_HREF}
                    appearance="neutral"
                    onError={setError}
                  />
                </>
              ) : (
                <CreateAccountForm onError={setError} onConfirm={setConfirmEmail} />
              )}

              <p className="mt-6 text-center text-sm text-muted">
                Personal account?{" "}
                <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:underline">
                  Sign in here
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
