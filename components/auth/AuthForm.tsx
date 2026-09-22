"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { loginAction } from "@/app/(auth)/login/actions";
import { signupAction } from "@/app/(auth)/signup/actions";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { AuthFormInput, AuthFormPasswordInput } from "@/components/auth/AuthFormInput";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import { Button } from "@/components/ui/Button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/Form";
import { trackEvent } from "@/lib/analytics";
import { withRedirect } from "@/lib/auth/redirect";
import { type SignupValues, loginSchema, signupSchema } from "@/lib/auth/validation";

type AuthMode = "login" | "signup";
const loginFormSchema = loginSchema.extend({ firstName: z.string(), lastName: z.string() });
const fields = [
  { name: "firstName", label: "First name", placeholder: "Your first name", autoComplete: "given-name", type: "text", signupOnly: true },
  { name: "lastName", label: "Last name", placeholder: "Your last name", autoComplete: "family-name", type: "text", signupOnly: true },
  { name: "email", label: "Email address", placeholder: "you@example.com", autoComplete: "email", type: "email", signupOnly: false },
  { name: "password", label: "Password", placeholder: "Your password", autoComplete: "current-password", type: "password", signupOnly: false },
] as const;

export function AuthForm({ mode, redirectTo, initialError }: {
  mode: AuthMode;
  redirectTo?: string | null;
  initialError?: string;
}) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const [globalError, setGlobalError] = useState(initialError ?? "");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const form = useForm<SignupValues>({
    resolver: zodResolver(isSignup ? signupSchema : loginFormSchema),
    mode: "onBlur",
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  useEffect(() => {
    if (isSignup) trackEvent("auth.signup.started");
  }, [isSignup]);

  const onSubmit = (values: SignupValues) => {
    setGlobalError("");
    setSuccessMessage("");
    startTransition(async () => {
      try {
        const result = isSignup
          ? await signupAction({ ...values, redirectTo })
          : await loginAction({ email: values.email, password: values.password, redirectTo });
        if (!result.success) {
          trackEvent(`auth.${mode}.failed`, { error_code: result.errorCode ?? "unknown" });
          setGlobalError(result.error ?? (isSignup ? "Something went wrong. Please try again." : "Incorrect email or password."));
          return;
        }
        trackEvent(`auth.${mode}.completed`, { method: "email" });
        if (isSignup) {
          setSuccessMessage(result.message ?? "Check your email to verify your account");
          window.setTimeout(() => router.push(withRedirect("/login", redirectTo)), 1000);
        } else {
          router.push(result.redirectTo ?? "/wishlists");
          router.refresh();
        }
      } catch {
        setGlobalError("Something went wrong. Please try again.");
      }
    });
  };

  return (
    <main className="min-h-dvh bg-peach lg:grid lg:grid-cols-9 lg:bg-white">
      <AuthVisual mode={mode} />
      <section aria-labelledby="auth-heading" className="relative flex min-w-0 flex-col rounded-t-3xl bg-white px-6 py-6 shadow-soft sm:px-12 lg:col-span-5 lg:justify-center lg:rounded-none lg:px-16 lg:py-12 lg:shadow-none">
        <div className="mx-auto w-full max-w-[344px] lg:max-w-[380px]">
          <header className="mb-5">
            <h1 id="auth-heading" className="font-display text-3xl text-ink lg:text-4xl">{isSignup ? "Create your account" : "Welcome back"}</h1>
            <p className="mt-1 text-sm leading-5 text-muted">{isSignup ? "Tell us about you. Use your name as it appears on your ID." : "Log in to see your dates, wishlists and pools."}</p>
          </header>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4" aria-busy={isPending}>
              <AuthAlert message={globalError} />
              <AuthAlert message={successMessage} tone="success" />
              {fields.filter((field) => isSignup || !field.signupOnly).map((config) => (
                <FormField key={config.name} control={form.control} name={config.name} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{config.label}</FormLabel>
                    {config.type === "password" ? (
                      <AuthFormPasswordInput {...field} placeholder={config.placeholder} autoComplete={isSignup ? "new-password" : "current-password"} required className="bg-surface text-base lg:text-sm" />
                    ) : (
                      <AuthFormInput {...field} type={config.type} placeholder={config.placeholder} autoComplete={config.autoComplete} required className="bg-surface text-base lg:text-sm" />
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
              ))}
              {!isSignup && <div className="flex justify-end"><Link href="/forgot-password" className="inline-flex min-h-11 items-center text-xs font-semibold text-brand underline-offset-4 hover:underline">Forgot password?</Link></div>}
              <Button type="submit" fullWidth size="lg" disabled={isPending || Boolean(successMessage)}>
                {isPending && <Loader2 aria-hidden className="size-4 animate-spin" />}
                {isPending ? (isSignup ? "Creating account…" : "Logging in…") : (isSignup ? "Create account" : "Log in")}
              </Button>
              <AuthDivider />
              <GoogleOAuthButton label="Continue with Google" flow={mode} redirectTo={redirectTo} onError={setGlobalError} appearance="neutral" />
            </form>
          </Form>
          <p className="mt-4 text-center text-xs text-muted">
            {isSignup ? "Already have an account?" : "New to Givftme?"}{" "}
            <Link href={withRedirect(isSignup ? "/login" : "/signup", redirectTo)} className="inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:underline">{isSignup ? "Log in" : "Create an account"}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
