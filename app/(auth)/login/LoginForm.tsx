"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { loginAction } from "@/app/(auth)/login/actions";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthDivider } from "@/components/auth/AuthDivider";
import {
  AuthFormInput,
  AuthFormPasswordInput,
} from "@/components/auth/AuthFormInput";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import { Button } from "@/components/ui/Button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/Form";
import { trackEvent } from "@/lib/analytics";
import { withRedirect } from "@/lib/auth/redirect";
import { type LoginValues, loginSchema } from "@/lib/auth/validation";

export function LoginForm({
  redirectTo,
  initialError,
}: {
  redirectTo?: string | null;
  initialError?: string;
}) {
  const router = useRouter();
  const [globalError, setGlobalError] = useState(initialError ?? "");
  const [isPending, startTransition] = useTransition();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginValues) => {
    setGlobalError("");

    startTransition(async () => {
      const result = await loginAction({ ...values, redirectTo });

      if (!result.success) {
        trackEvent("auth.login.failed", { error_code: result.errorCode ?? "unknown" });
        setGlobalError(result.error ?? "Incorrect email or password.");
        return;
      }

      trackEvent("auth.login.completed", { method: "email" });
      router.push(result.redirectTo ?? "/wishlists");
      router.refresh();
    });
  };

  return (
    <AuthPageShell
      title="Welcome back home"
      subtitle="Enter the necessary details"
      backHref={withRedirect("/welcome", redirectTo)}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <AuthAlert message={globalError} />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <AuthFormInput
                  type="email"
                  placeholder="Enter your email address"
                  autoComplete="email"
                  {...field}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <AuthFormPasswordInput
                  placeholder="Enter your email address"
                  autoComplete="current-password"
                  {...field}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="-mt-2 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-brand"
            >
              Forgot Password?
            </Link>
          </div>

          <Button type="submit" fullWidth disabled={isPending} className="h-12">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Login
          </Button>

          <AuthDivider />

          <GoogleOAuthButton
            label="Continue with Google"
            flow="login"
            redirectTo={redirectTo}
            onError={setGlobalError}
          />
        </form>
      </Form>

      <p className="mt-auto pt-10 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={withRedirect("/signup", redirectTo)}
          className="font-semibold text-ink"
        >
          Signup
        </Link>
      </p>
    </AuthPageShell>
  );
}
