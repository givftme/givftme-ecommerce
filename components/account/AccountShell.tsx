"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Bell, ChevronRight, Package, ShieldCheck, UserRound } from "lucide-react";
import { SignOutButton } from "@/components/account/SignOutButton";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/account/profile", label: "Profile", description: "Your details and profile photo", icon: UserRound },
  { href: "/account/orders", label: "Orders", description: "Your purchases and delivery updates", icon: Package },
  { href: "/account/notifications", label: "Notifications & Reminders", description: "Updates about the dates that matter", icon: Bell },
  { href: "/account/security", label: "Sign-in & Security", description: "How you access your account", icon: ShieldCheck },
];

export function AccountShell({ name, email, avatarUrl, children }: {
  name: string; email: string; avatarUrl: string | null; children: ReactNode;
}) {
  const pathname = usePathname();
  const isHub = pathname === "/account";
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
        <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
          <aside className={cn("min-w-0 rounded-2xl border border-stone-100 bg-white p-5 md:p-6", !isHub && "hidden lg:block")}>
            <div className="flex items-center gap-3 border-b border-stone-100 pb-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light text-lg font-semibold text-brand">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : name.trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="break-words text-base font-semibold text-ink">{name}</p>
                {email && <p className="mt-1 break-all text-sm text-muted">{email}</p>}
              </div>
            </div>
            <nav aria-label="Account" className="mt-4">
              <ul className="space-y-2">
                {sections.map(({ href, label, description, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <li key={href}>
                      <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-12 items-center gap-3 rounded-xl px-3 py-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand", active ? "bg-brand-light font-semibold text-brand" : "text-ink hover:bg-surface")}>
                        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{label}</span>
                          <span className="mt-1 block text-xs font-normal leading-5 text-muted lg:hidden">{description}</span>
                        </span>
                        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="mt-8 border-t border-stone-100 pt-5"><SignOutButton /></div>
          </aside>
          <div className={cn("min-w-0 rounded-2xl border border-stone-100 bg-white p-5 md:p-8 lg:col-span-2", isHub && "hidden lg:block")}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
