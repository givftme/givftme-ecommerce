"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  Camera,
  Globe,
  Handshake,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Palette,
  Repeat,
  Upload,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useBizDash, type BizView } from "@/components/business-dashboard/BizDashContext";
import { BUSINESS_ROLE_LABELS } from "@/lib/business-dashboard/data";
import type { BusinessPermission } from "@/lib/business-dashboard/permissions";
import { initials } from "@/lib/business-dashboard/utils";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface NavItem {
  view: BizView;
  label: string;
  icon: LucideIcon;
  permission?: BusinessPermission;
}

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Plan",
    items: [
      { view: "overview", label: "Overview", icon: LayoutDashboard },
      { view: "upcoming", label: "Upcoming moments", icon: CalendarClock },
      { view: "calendar", label: "Year calendar", icon: CalendarDays },
      { view: "campaigns", label: "Campaigns", icon: Megaphone },
    ],
  },
  {
    label: "People",
    items: [
      { view: "staff", label: "Staff", icon: Users },
      { view: "clients", label: "Clients & partners", icon: Handshake },
      { view: "import", label: "Bulk upload", icon: Upload, permission: "edit_people" },
    ],
  },
  {
    label: "Run",
    items: [
      { view: "rules", label: "Automatic rules", icon: Repeat },
      { view: "proof", label: "Deliveries", icon: Camera },
      { view: "budget", label: "Budget & invoices", icon: Wallet, permission: "view_budget" },
    ],
  },
  {
    label: "Company",
    items: [
      { view: "brand", label: "Brand kit", icon: Palette },
      { view: "team", label: "Team & approvals", icon: UsersRound },
    ],
  },
];

/** The company mark: logo, or initials on the company's brand colour. */
export function CompanyMark({ className }: { className?: string }) {
  const { account } = useBizDash();
  return account.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element -- logos are data URLs or arbitrary hosts
    <img
      src={account.logo_url}
      alt=""
      className={cn("h-9 w-9 shrink-0 rounded-xl bg-white object-contain p-1", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      style={{ backgroundColor: "var(--company-brand)" }}
      className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white", className)}
    >
      {initials(account.company_name)}
    </span>
  );
}

/** Dark sidebar nav. A fixed overlay at 1000px and below. */
export function BizDashSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { account, member, view, go, can, campaigns } = useBizDash();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const pending = campaigns.filter((campaign) => campaign.status === "Pending approval").length;

  const signOut = async () => {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.replace("/business-dashboard/auth");
    router.refresh();
  };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-[55] bg-black/40 transition-opacity duration-300 min-[1001px]:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        id="biz-sidebar"
        aria-label="Business dashboard"
        className={cn(
          "flex h-dvh w-[260px] shrink-0 flex-col bg-neutral-950 text-white",
          "min-[1001px]:sticky min-[1001px]:top-0",
          "max-[1000px]:fixed max-[1000px]:left-0 max-[1000px]:top-0 max-[1000px]:z-[60] max-[1000px]:transition-transform max-[1000px]:duration-300",
          open ? "max-[1000px]:translate-x-0" : "max-[1000px]:-translate-x-[102%]",
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <CompanyMark />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold">{account.company_name}</p>
            <p className="text-[11px] text-white/60">Givftme for Business · {account.plan}</p>
          </div>
        </div>

        <nav aria-label="Dashboard sections" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-white/45">{group.label}</h2>
              <ul className="space-y-0.5">
                {group.items
                  .filter((item) => !item.permission || can(item.permission))
                  .map((item) => {
                    const active = view === item.view;
                    const Icon = item.icon;
                    return (
                      <li key={item.view}>
                        <button
                          type="button"
                          onClick={() => {
                            go(item.view);
                            onClose();
                          }}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                            active ? "bg-white/10 font-semibold text-white" : "text-white/75 hover:bg-white/5 hover:text-white",
                          )}
                        >
                          <Icon aria-hidden="true" className={cn("h-[18px] w-[18px] shrink-0", active && "text-brand")} />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.view === "campaigns" && pending > 0 ? (
                            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-neutral-950">
                              {pending}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="border-t border-white/10 px-3 py-2">
          <a
            href="/business"
            className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-white/75 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Globe aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            Givftme for Business site
          </a>
        </div>

        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3">
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold">
            {initials(member.full_name)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{member.full_name}</p>
            <p className="text-[11px] text-white/60">{BUSINESS_ROLE_LABELS[member.role]}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            aria-label="Sign out"
            className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}
