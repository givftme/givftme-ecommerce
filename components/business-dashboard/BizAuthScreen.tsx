"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, MailCheck } from "lucide-react";
import { Field, Select } from "@/components/business-dashboard/BizUi";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AUTH_FEATURES, SIGNUP_ROLES } from "@/lib/business-dashboard/data";
import {
  businessSignInSchema,
  businessSignUpSchema,
  type BusinessSignInValues,
  type BusinessSignUpValues,
} from "@/lib/business-dashboard/validation";
import { cn } from "@/lib/utils";

type Tab = "signin" | "create";

async function post(path: string, values: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: string; redirectTo?: string; needsConfirmation?: boolean }
    | null;
  return { ok: response.ok, body };
}

function SignInForm({ onError }: { onError: (message: string) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BusinessSignInValues>({ resolver: zodResolver(businessSignInSchema) });

  const onSubmit = handleSubmit(async (values) => {
    onError("");
    try {
      const { ok, body } = await post("/api/business-dashboard/auth/signin", values);
      if (!ok) {
        onError(body?.error || "Something went wrong. Please try again.");
        return;
      }
      // A full navigation so the server renders with the new session cookies.
      window.location.assign(body?.redirectTo || "/business-dashboard");
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
      window.location.assign(body?.redirectTo || "/business-dashboard");
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

/** Sign in / Create a business account, with the dark feature panel on desktop. */
export function BizAuthScreen({ initialTab, initialError }: { initialTab: Tab; initialError: string | null }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [error, setError] = useState(initialError ?? "");
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

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

              {tab === "signin" ? (
                <>
                  <SignInForm onError={setError} />
                  <div className="my-5 flex items-center gap-3 text-xs text-muted">
                    <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
                  </div>
                  <GoogleOAuthButton
                    label="Continue with company Google / Microsoft"
                    flow="login"
                    redirectTo="/business-dashboard"
                    appearance="neutral"
                    onError={setError}
                  />
                </>
              ) : (
                <CreateAccountForm onError={setError} onConfirm={setConfirmEmail} />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
