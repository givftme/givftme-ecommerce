"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { resetPasswordAction } from "@/app/auth/reset-password/actions";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthFormPasswordInput } from "@/components/auth/AuthFormInput";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/Button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/Form";
import {
  type ResetPasswordValues,
  resetPasswordSchema,
} from "@/lib/auth/validation";

export function ResetPasswordForm() {
  const router = useRouter();
  const [globalError, setGlobalError] = useState("");
  const [isPending, startTransition] = useTransition();
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (values: ResetPasswordValues) => {
    setGlobalError("");

    startTransition(async () => {
      const result = await resetPasswordAction(values);

      if (!result.success) {
        setGlobalError(
          result.error ?? "Couldn't update your password. Try again."
        );
        return;
      }

      window.sessionStorage.removeItem("reset_email");
      router.push("/auth/success");
    });
  };

  return (
    <AuthPageShell
      title="Reset Password"
      subtitle="Enter your new password below."
      backHref="/auth/verify-otp"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <AuthAlert message={globalError} />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <AuthFormPasswordInput
                  placeholder="Enter your email address"
                  autoComplete="new-password"
                  {...field}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <AuthFormPasswordInput
                  placeholder="Enter your email address"
                  autoComplete="new-password"
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
    </AuthPageShell>
  );
}
