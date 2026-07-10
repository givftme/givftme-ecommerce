"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export type AuthPasswordInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

const AuthPasswordInput = forwardRef<HTMLInputElement, AuthPasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={isVisible ? "text" : "password"}
          className={cn("pr-12", className)}
          {...props}
        />
        <button
          type="button"
          aria-label={isVisible ? "Hide password" : "Show password"}
          onClick={() => setIsVisible((visible) => !visible)}
          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
AuthPasswordInput.displayName = "AuthPasswordInput";

export { AuthPasswordInput };
