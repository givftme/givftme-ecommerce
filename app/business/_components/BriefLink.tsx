"use client";

import type { ReactNode } from "react";
import { Btn, type BtnSize, type BtnTone } from "@/components/ui/primitives";
import { type BriefInput, useBusiness } from "@/app/business/_components/BusinessContext";

export const EXPERIENCE_CENTRE_HREF = "#experience-centre";

/** A CTA that jumps to the Experience Centre and prefills the brief with its context. */
export function BriefLink({
  brief,
  tone = "brand",
  size,
  magnetic,
  className,
  children,
}: {
  brief: BriefInput;
  tone?: BtnTone;
  size?: BtnSize;
  magnetic?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { planBrief } = useBusiness();

  return (
    <Btn
      as="a"
      href={EXPERIENCE_CENTRE_HREF}
      tone={tone}
      size={size}
      magnetic={magnetic}
      className={className}
      onClick={() => planBrief(brief)}
    >
      {children}
    </Btn>
  );
}
