"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { signupAction } from "@/app/(auth)/signup/actions";
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
import { withRedirect } from "@/lib/auth/redirect";
import { type SignupValues, signupSchema } from "@/lib/auth/validation";

export function SignupForm({ redirectTo }: { redirectTo?: string | null }) {
  const router = useRouter();
  const [globalError, setGlobalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = (values: SignupValues) => {
    setGlobalError("");
    setSuccessMessage("");

    startTransition(async () => {
      const result = await signupAction({ ...values, redirectTo });

      if (!result.success) {
        setGlobalError(
          result.error ?? "Something went wrong. Please try again.",
        );
        return;
      }

      setSuccessMessage(
        result.message ?? "Check your email to verify your account",
      );
      window.setTimeout(() => {
        router.push(withRedirect("/login", redirectTo));
      }, 1000);
    });
  };

  return (
    <AuthPageShell
      title="Let's get you started"
      subtitle="Tell us more about you, please use your name as it appears on your ID."
      backHref={withRedirect("/welcome", redirectTo)}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <AuthAlert message={globalError} />
          <AuthAlert message={successMessage} tone="success" />

          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name</FormLabel>
                <AuthFormInput placeholder="Enter your first name" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name</FormLabel>
                <AuthFormInput placeholder="Enter your last name" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email address</FormLabel>
                <AuthFormInput
                  type="email"
                  placeholder="Enter your email"
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
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  {...field}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" fullWidth disabled={isPending} className="h-12">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Signup
          </Button>

          <AuthDivider />

          <GoogleOAuthButton
            label="Signup with Google"
            redirectTo={redirectTo}
            onError={setGlobalError}
          />
        </form>
      </Form>

      <p className="mt-auto pt-10 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={withRedirect("/login", redirectTo)}
          className="font-semibold text-ink"
        >
          Login
        </Link>
      </p>
    </AuthPageShell>
  );
}
