"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  FileText,
  Gift,
  Gamepad2,
  LifeBuoy,
  MapPin,
  Package,
  Sparkles,
  TicketPercent,
  UserRound,
} from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { AccountAvatar } from "@/components/account/AccountAvatar";
import { SignOutButton } from "@/components/account/SignOutButton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "Personal",
    items: [
      { href: "/account/profile", label: "Profile Details", icon: UserRound },
      { href: "/account/addresses", label: "Addresses", icon: MapPin },
      { href: "/account/orders", label: "My Orders", icon: Package },
      { label: "Rewards", icon: Gift, comingSoon: true },
    ],
  },
  {
    label: "Services",
    items: [
      { label: "Referrals", icon: Sparkles, comingSoon: true },
      { label: "Coupon", icon: TicketPercent, comingSoon: true },
    ],
  },
  {
    label: "Entertainment",
    items: [{ label: "Games", icon: Gamepad2, comingSoon: true }],
  },
  {
    label: "More",
    items: [
      { label: "What's New", icon: Sparkles, comingSoon: true },
      { label: "FAQ", icon: CircleHelp, comingSoon: true },
      { label: "Legal", icon: FileText, comingSoon: true },
      { label: "Get help", icon: LifeBuoy, comingSoon: true },
    ],
  },
];

export function AccountShell({
  name,
  email,
  avatarUrl,
  userId = "",
  children,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  userId?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isHub = pathname === "/account";
  const navRef = useRef<HTMLElement>(null);
  const { toast } = useToast();

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const items = gsap.utils.toArray<HTMLElement>("[data-account-nav-item]", navRef.current);
      gsap.from(items, { autoAlpha: 0, x: -20, stagger: 0.05, duration: 0.3 });
    });
    return () => media.revert();
  }, { scope: navRef });

  return (
    <section className="bg-surface py-8 md:py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        {isHub ? (
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-ink">Account</h1>
            <p className="mt-2 text-sm text-muted">Your details, orders and settings, all in one place.</p>
          </header>
        ) : (
          <Link href="/account" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to Account
          </Link>
        )}
        <div className="rounded-2xl border border-stone-100 bg-white lg:flex">
          <aside className={cn("min-w-0 p-5 md:p-6 lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-stone-100", !isHub && "hidden")}>
            <div className="flex items-center gap-3 border-b border-stone-100 pb-6">
              <AccountAvatar name={name} userId={userId} avatarUrl={avatarUrl} size={isHub ? "md" : "sm"} />
              <div className="min-w-0">
                <p className={cn("break-words font-semibold text-ink", isHub ? "text-lg" : "text-base")}>{name}</p>
                {email && <p className="mt-1 break-all text-sm text-muted">{email}</p>}
              </div>
            </div>
            <nav ref={navRef} aria-label="Account" className="mt-6 mb-8">
              {groups.map((group) => (
                <section key={group.label} className="mb-6 last:mb-0" aria-label={group.label}>
                  <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">{group.label}</h2>
                  <ul className="space-y-1">
                    {group.items.map(({ href, label, icon: Icon, comingSoon }) => {
                      const active = Boolean(href && (pathname === href || pathname.startsWith(`${href}/`)));
                      const classes = cn(
                        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        active ? "bg-brand-light font-semibold text-brand" : "text-ink hover:bg-surface",
                        comingSoon && "w-full text-left",
                      );
                      const body = <><Icon aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1">{label}</span>{href && <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />}</>;

                      return (
                        <li key={label} data-account-nav-item>
                          {href ? (
                            <Link href={href} aria-current={active ? "page" : undefined} className={classes}>{body}</Link>
                          ) : (
                            <button type="button" className={classes} onClick={() => toast({ title: "Coming soon" })}>{body}</button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </nav>
            <div className="mt-auto border-t border-stone-100 pt-5"><SignOutButton /></div>
          </aside>
          <div className={cn("min-w-0 flex-1 p-5 md:p-8 lg:p-10", isHub && "hidden lg:block")}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
