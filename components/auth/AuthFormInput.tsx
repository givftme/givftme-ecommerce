"use client";

import { forwardRef } from "react";
import { Input, type InputProps } from "@/components/ui/Input";
import { useFormField } from "@/components/ui/Form";
import {
  AuthPasswordInput,
  type AuthPasswordInputProps,
} from "@/components/auth/AuthPasswordInput";

const AuthFormInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { error, formItemId, formMessageId } = useFormField();

  return (
    <Input
      ref={ref}
      id={formItemId}
      aria-describedby={error ? formMessageId : undefined}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
});
AuthFormInput.displayName = "AuthFormInput";

const AuthFormPasswordInput = forwardRef<
  HTMLInputElement,
  AuthPasswordInputProps
>((props, ref) => {
  const { error, formItemId, formMessageId } = useFormField();

  return (
    <AuthPasswordInput
      ref={ref}
      id={formItemId}
      aria-describedby={error ? formMessageId : undefined}
      aria-invalid={Boolean(error)}
      {...props}
    />
  );
});
AuthFormPasswordInput.displayName = "AuthFormPasswordInput";

export { AuthFormInput, AuthFormPasswordInput };
