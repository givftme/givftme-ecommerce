"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthAlert } from "@/components/auth/AuthAlert";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { OtpDisplay } from "@/components/auth/OtpDisplay";
import { OtpKeypad } from "@/components/auth/OtpKeypad";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const RESEND_SECONDS = 94;

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, "0");

  return `${minutes}:${remainingSeconds}s`;
}

function otpErrorMessage(message: string) {
  return message.toLowerCase().includes("expired")
    ? "That code has expired. Request a new one."
    : "That code is incorrect. Try again or resend.";
}

export function VerifyOtpScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const submittedCodeRef = useRef("");

  useEffect(() => {
    const storedEmail = window.sessionStorage.getItem("reset_email");

    if (!storedEmail) {
      router.replace("/auth/forgot-password");
      return;
    }

    window.queueMicrotask(() => {
      setEmail(storedEmail);
    });
  }, [router]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const verifyCode = useCallback(
    async (code: string) => {
      if (!email || code.length !== 6 || isVerifying) {
        return;
      }

      setError("");
      setIsVerifying(true);
      submittedCodeRef.current = code;

      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (verifyError) {
        setIsVerifying(false);
        setError(otpErrorMessage(verifyError.message));
        setErrorKey((key) => key + 1);
        setOtp("");
        submittedCodeRef.current = "";
        return;
      }

      router.push("/auth/reset-password");
    },
    [email, isVerifying, router]
  );

  useEffect(() => {
    if (otp.length === 6 && submittedCodeRef.current !== otp) {
      void verifyCode(otp);
    }
  }, [otp, verifyCode]);

  const handleDigit = (digit: string) => {
    if (isVerifying) {
      return;
    }

    setError("");
    setOtp((current) => (current.length < 6 ? `${current}${digit}` : current));
  };

  const handleBackspace = () => {
    if (isVerifying) {
      return;
    }

    setOtp((current) => current.slice(0, -1));
    submittedCodeRef.current = "";
  };

  const handleResend = async () => {
    if (!email || secondsLeft > 0 || isResending) {
      return;
    }

    setIsResending(true);
    setError("");

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    setIsResending(false);

    if (resendError) {
      setError("Something went wrong. Please try again.");
      return;
    }

    setOtp("");
    submittedCodeRef.current = "";
    setSecondsLeft(RESEND_SECONDS);
  };

  return (
    <AuthPageShell
      title="Verification"
      subtitle={
        <>
          Please input the OTP sent to your Email address{" "}
          <span className="font-semibold text-ink">{email || "..."}</span> to
          complete the registration process.
        </>
      }
      backHref="/auth/forgot-password"
    >
      <div className="space-y-7">
        <AuthAlert message={error} />

        <OtpDisplay value={otp} errorKey={errorKey} />

        <p className="text-center text-xs text-muted">
          Didn&apos;t get OTP?{" "}
          {secondsLeft > 0 ? (
            <span>
              Resend in{" "}
              <span className="font-semibold text-ink">
                {formatCountdown(secondsLeft)}
              </span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="font-semibold text-brand disabled:opacity-60"
            >
              {isResending ? "Resending..." : "Resend OTP"}
            </button>
          )}
        </p>

        <OtpKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          disabled={isVerifying}
        />
      </div>

      <div className="mt-auto pt-8">
        <Button
          type="button"
          fullWidth
          disabled={otp.length !== 6 || isVerifying}
          onClick={() => void verifyCode(otp)}
          className="h-12"
        >
          {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
          {isVerifying ? "Verifying..." : "Continue"}
        </Button>
      </div>
    </AuthPageShell>
  );
}
