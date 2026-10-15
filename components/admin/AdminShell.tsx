"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Banknote,
  BellOff,
  Briefcase,
  Building2,
  CalendarDays,
  Gift,
  Globe2,
  HandCoins,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Star,
  TrendingUp,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/Sheet";
import {
  canAccessScreen,
  navForRole,
  navItemForPath,
  ROLE_LABELS,
  type AdminRole,
  type AdminScreen,
} from "@/lib/admin/roles";
import { cn } from "@/lib/utils";

const ICONS: Record<AdminScreen, LucideIcon> = {
  pulse: Activity,
  growth: TrendingUp,
  calendar: CalendarDays,
  wishlists: Gift,
  segments: UsersRound,
  orders: Package,
  pools: HandCoins,
  reminders: BellOff,
  demand: Search,
  corporate: Building2,
  diaspora: Globe2,
  money: Banknote,
  people: UserRound,
  reviews: Star,
  enquiries: Briefcase,
};

const COLLAPSE_KEY = "givftme-admin-sidebar-collapsed";

// The collapsed preference lives in localStorage; the server always renders
// the sidebar expanded, so hydration never mismatches.
const collapseListeners = new Set<() => void>();

function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    collapseListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    // Not persisted; the change still applies to this page.
  }
  collapseListeners.forEach((listener) => listener());
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function SidebarNav({ role, collapsed, onNavigate }: { role: AdminRole; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="space-y-5">
      {navForRole(role).map((group) => (
        <section key={group.label} aria-label={group.label}>
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-line" aria-hidden="true" />
          ) : (
            <h2 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{group.label}</h2>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.screen];
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                      collapsed && "justify-center px-0",
                      active ? "bg-brand-light font-semibold text-brand" : "text-ink hover:bg-surface",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                    {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href="/admin/pulse" className="flex min-h-10 items-center gap-2 rounded-xl px-3 font-display text-xl text-ink focus-visible:outline-2 focus-visible:outline-brand">
      <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">G</span>
      {collapsed ? <span className="sr-only">Givftme admin</span> : <span>Givftme <span className="text-sm text-muted">admin</span></span>}
    </Link>
  );
}

export interface AdminShellMember {
  fullName: string;
  email: string;
  role: AdminRole;
}

export function AdminShell({ member, children }: { member: AdminShellMember; children: ReactNode }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleCollapsed = () => writeCollapsed(!collapsed);

  const current = navItemForPath(pathname);
  const isDetail = Boolean(current && pathname !== current.href);
  const canSearchPeople = canAccessScreen(member.role, "people");

  return (
    <div className="min-h-screen bg-surface lg:flex">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-card py-4 transition-[width] lg:flex",
          collapsed ? "w-[72px] px-2" : "w-64 px-3",
        )}
      >
        <Brand collapsed={collapsed} />
        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pb-4">
          <SidebarNav role={member.role} collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-brand",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" className="h-[18px] w-[18px]" /> : <><PanelLeftClose aria-hidden="true" className="h-[18px] w-[18px]" /> Collapse</>}
        </button>
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="inset-y-0 bottom-auto left-0 right-auto h-full w-72 max-w-[85vw] overflow-y-auto rounded-none rounded-r-2xl p-4 md:left-0 md:max-w-xs md:translate-x-0">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <Brand collapsed={false} />
          <div className="mt-5">
            <SidebarNav role={member.role} collapsed={false} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-4 md:px-6">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand lg:hidden"
            >
              <Menu aria-hidden="true" className="h-5 w-5" />
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                <li className="hidden text-muted sm:block">Admin</li>
                {current ? (
                  <>
                    <li aria-hidden="true" className="hidden text-muted sm:block">/</li>
                    <li className="min-w-0 truncate">
                      {isDetail ? (
                        <Link href={current.href} className="text-muted hover:text-ink hover:underline">{current.label}</Link>
                      ) : (
                        <span className="font-semibold text-ink">{current.label}</span>
                      )}
                    </li>
                    {isDetail ? (
                      <>
                        <li aria-hidden="true" className="text-muted">/</li>
                        <li className="truncate font-semibold text-ink">Detail</li>
                      </>
                    ) : null}
                  </>
                ) : null}
              </ol>
            </nav>
            {canSearchPeople ? (
              <form action="/admin/people" role="search" className="relative hidden md:block">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <label htmlFor="admin-global-search" className="sr-only">Search people by name or email</label>
                <input
                  id="admin-global-search"
                  name="q"
                  type="search"
                  placeholder="Search people…"
                  className="h-10 w-56 rounded-full border border-line bg-surface pl-9 pr-4 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20 xl:w-72"
                />
              </form>
            ) : null}
            <div className="flex shrink-0 items-center gap-2.5">
              <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-brand-light text-xs font-bold text-brand">
                {initials(member.fullName)}
              </span>
              <div className="hidden min-w-0 leading-tight sm:block">
                <p className="max-w-40 truncate text-sm font-semibold text-ink">{member.fullName}</p>
                <span className="inline-flex rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand">{ROLE_LABELS[member.role]}</span>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">{children}</main>
      </div>
    </div>
  );
}
