"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { sendPasswordOtpAction } from "@/app/(auth)/forgot-password/actions";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthFormInput } from "@/components/auth/AuthFormInput";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/Form";
import { trackEvent } from "@/lib/analytics";
import {
  type ForgotPasswordValues,
  forgotPasswordSchema,
} from "@/lib/auth/validation";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState("");
  const [isPending, startTransition] = useTransition();
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (values: ForgotPasswordValues) => {
    setGlobalError("");

    startTransition(async () => {
      const result = await sendPasswordOtpAction(values);

      if (!result.success) {
        setGlobalError(result.error ?? "Something went wrong. Please try again.");
        return;
      }

      trackEvent("auth.password_reset.requested");
      window.sessionStorage.setItem("reset_email", values.email);
      router.push("/verify-otp");
    });
  };

  return (
    <AuthPageShell
      title="Forget Password"
      subtitle="Enter the necessary details"
      backHref="/login"
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

          <Button type="submit" fullWidth disabled={isPending} className="h-12">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </form>
      </Form>

      <p className="mt-auto pt-10 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/signup" className="font-semibold text-ink">
          Signup
        </Link>
      </p>
    </AuthPageShell>
  );
}
