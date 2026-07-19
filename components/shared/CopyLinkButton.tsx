"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";

gsap.registerPlugin(useGSAP);

export function CopyLinkButton({
  value,
  disabled = false,
}: {
  value: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copiedRef = useRef<HTMLSpanElement>(null);
  const { toast } = useToast();

  useGSAP(
    () => {
      if (!copied || !copiedRef.current) {
        return;
      }

      gsap.from(copiedRef.current, {
        autoAlpha: 0,
        scale: 0.8,
        duration: 0.2,
        ease: "power2.out",
      });
      gsap.to(copiedRef.current, {
        autoAlpha: 0,
        delay: 1.8,
        duration: 0.2,
      });
    },
    { dependencies: [copied], scope: copiedRef }
  );

  const copy = async () => {
    if (disabled || !value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      trackEvent("wishlist.link.copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy link. Try again.", variant: "danger" });
    }
  };

  return (
    <Button type="button" onClick={() => void copy()} disabled={disabled}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? (
        <span ref={copiedRef}>Copied!</span>
      ) : (
        <span>Copy link</span>
      )}
    </Button>
  );
}
