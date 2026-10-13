"use client";

import type { MouseEvent } from "react";
import { type LucideIcon, ArrowUpRight, Headset, Mail, MessageCircle, Phone } from "lucide-react";
import { Eyebrow, Icon, Reveal, Wrap } from "@/components/ui/primitives";
import { useFeedback } from "@/hooks/useFeedback";
import { CONTACT, WHATSAPP_GREETING } from "@/app/business/_components/content";
import { EnquiryForm } from "@/app/business/_components/EnquiryForm";

interface ContactWay {
  icon: LucideIcon;
  tint: string;
  title: string;
  label: string;
  /** Null until the channel is configured in CONTACT. */
  href: string | null;
  external?: boolean;
}

const WAYS: ContactWay[] = [
  {
    icon: MessageCircle,
    tint: "bg-success/15 text-success",
    title: "Chat on WhatsApp",
    label: CONTACT.whatsappLabel,
    href: CONTACT.whatsappNumber
      ? `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(WHATSAPP_GREETING)}`
      : null,
    external: true,
  },
  {
    icon: Mail,
    tint: "bg-brand-light text-brand",
    title: "Email the team",
    label: CONTACT.emailLabel,
    href: CONTACT.email ? `mailto:${CONTACT.email}` : null,
  },
  {
    icon: Phone,
    tint: "bg-peach text-orange",
    title: "Call us",
    label: CONTACT.phoneLabel,
    href: CONTACT.phone ? `tel:${CONTACT.phone}` : null,
  },
];

export function ExperienceCentre() {
  const { toast } = useFeedback();

  const notLive = (e: MouseEvent) => {
    e.preventDefault();
    toast("That option isn’t live yet. Send a brief with the form instead.");
  };

  return (
    <section
      id="experience-centre"
      aria-labelledby="experience-centre-heading"
      className="pb-24 max-sm:pb-16"
    >
      <Wrap>
        <Reveal className="relative grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-10 overflow-hidden rounded-card-xl bg-ink-deep p-12 text-white max-lg:grid-cols-1 max-sm:px-4.5 max-sm:py-6.5">
          <div
            aria-hidden="true"
            className="absolute -bottom-60 -left-50 size-130 rounded-full bg-[radial-gradient(closest-side,rgba(225,29,46,0.45),transparent)]"
          />

          <div className="relative flex min-w-0 flex-col gap-4">
            <Eyebrow tone="amber">
              <Icon as={Headset} size={16} />
              Givftme Experience Centre
            </Eyebrow>
            <h2
              id="experience-centre-heading"
              className="font-display text-[clamp(32px,4.2vw,52px)] leading-[1.08]"
            >
              Let’s plan your next company moment.
            </h2>
            <p className="max-w-[30em] text-base text-white/75">
              Talk to a gifting expert. We’ll send mockups with your brand on them.
            </p>

            <ul className="flex flex-col gap-2.5">
              {WAYS.map(({ icon, tint, title, label, href, external }) => (
                <li key={title}>
                  <a
                    href={href ?? "#experience-centre"}
                    onClick={href ? undefined : notLive}
                    {...(external && href ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="flex items-center gap-3.5 rounded-[18px] border border-white/8 bg-white/6 px-4 py-3.5 transition-colors duration-200 hover:bg-white/12"
                  >
                    <span className={`grid size-10.5 shrink-0 place-items-center rounded-xl ${tint}`}>
                      <Icon as={icon} />
                    </span>
                    <div>
                      <b className="block text-[14.5px] font-semibold">{title}</b>
                      <span className="text-[12.5px] text-white/75">{label}</span>
                    </div>
                    <Icon as={ArrowUpRight} size={16} className="ml-auto text-white/75" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative min-w-0">
            <EnquiryForm />
          </div>
        </Reveal>
      </Wrap>
    </section>
  );
}
