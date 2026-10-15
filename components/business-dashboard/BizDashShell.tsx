"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  BizDashContext,
  type BizDashContextValue,
  type BizView,
  type BriefOptions,
  type CampaignWizardOptions,
  type GoOptions,
} from "@/components/business-dashboard/BizDashContext";
import { BizDashSidebar } from "@/components/business-dashboard/BizDashSidebar";
import { BizDashTopbar } from "@/components/business-dashboard/BizDashTopbar";
import { ToastProvider, useToast } from "@/components/business-dashboard/Toast";
import { BriefModal } from "@/components/business-dashboard/modals/BriefModal";
import { CampaignWizard } from "@/components/business-dashboard/modals/CampaignWizard";
import { PersonModal } from "@/components/business-dashboard/modals/PersonModal";
import { BizBrand } from "@/components/business-dashboard/views/BizBrand";
import { BizBudget } from "@/components/business-dashboard/views/BizBudget";
import { BizCalendar } from "@/components/business-dashboard/views/BizCalendar";
import { BizCampaigns } from "@/components/business-dashboard/views/BizCampaigns";
import { BizClients } from "@/components/business-dashboard/views/BizClients";
import { BizImport } from "@/components/business-dashboard/views/BizImport";
import { BizOverview } from "@/components/business-dashboard/views/BizOverview";
import { BizProof } from "@/components/business-dashboard/views/BizProof";
import { BizRules } from "@/components/business-dashboard/views/BizRules";
import { BizStaff } from "@/components/business-dashboard/views/BizStaff";
import { BizTeam } from "@/components/business-dashboard/views/BizTeam";
import { BizUpcoming } from "@/components/business-dashboard/views/BizUpcoming";
import type { CampaignStatus } from "@/lib/business-dashboard/data";
import { canBusiness, SAVE_FAILED_MESSAGE, type BusinessPermission } from "@/lib/business-dashboard/permissions";
import type { ActionResult, BusinessDashboardData, BusinessPerson, PersonKind } from "@/lib/business-dashboard/types";
import { downloadText, fromIsoDate, toIsoDate, upcomingMoments } from "@/lib/business-dashboard/utils";

const VIEWS: Record<BizView, () => React.ReactNode> = {
  overview: BizOverview,
  upcoming: BizUpcoming,
  staff: BizStaff,
  clients: BizClients,
  import: BizImport,
  campaigns: BizCampaigns,
  calendar: BizCalendar,
  rules: BizRules,
  proof: BizProof,
  budget: BizBudget,
  brand: BizBrand,
  team: BizTeam,
};

type PersonModalState = { kind: PersonKind; person?: BusinessPerson } | null;

function Dashboard({ data, todayIso }: { data: BusinessDashboardData; todayIso: string }) {
  const router = useRouter();
  const toast = useToast();
  const [, startRefresh] = useTransition();

  // View switching is client-side only: no URL change per view.
  const [view, setView] = useState<BizView>("overview");
  const [upcomingMonth, setUpcomingMonth] = useState<string | null>(null);
  const [importKind, setImportKind] = useState<PersonKind>("staff");
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | "All">("All");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [personModal, setPersonModal] = useState<PersonModalState>(null);
  const [campaignWizard, setCampaignWizard] = useState<CampaignWizardOptions | null>(null);
  const [brief, setBrief] = useState<BriefOptions | null>(null);

  // "Today" is the server's Lagos date, so server and client render the same.
  const today = useMemo(() => fromIsoDate(todayIso), [todayIso]);
  const moments = useMemo(
    () => upcomingMoments(data.people, data.campaigns, 365, today),
    [data.people, data.campaigns, today],
  );
  const staff = useMemo(() => data.people.filter((person) => person.kind === "staff"), [data.people]);
  const clients = useMemo(() => data.people.filter((person) => person.kind === "client"), [data.people]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);

  const go = useCallback((next: BizView, options: GoOptions = {}) => {
    setView(next);
    if (next === "upcoming") setUpcomingMonth(options.month ?? null);
    if (options.importKind) setImportKind(options.importKind);
    if (options.campaignStatus) setCampaignStatus(options.campaignStatus);
    window.scrollTo({ top: 0 });
  }, []);

  const run = useCallback(
    async <T,>(action: () => Promise<ActionResult<T>>, success?: string | ((value: T) => string)) => {
      let result: ActionResult<T>;
      try {
        result = await action();
      } catch {
        result = { ok: false, error: SAVE_FAILED_MESSAGE };
      }
      if (result.ok) {
        if (success) toast(typeof success === "function" ? success(result.data) : success);
        refresh();
      } else {
        toast(result.error);
      }
      return result;
    },
    [refresh, toast],
  );

  const exportSchedule = useCallback(async () => {
    try {
      const response = await fetch("/api/business-dashboard/export-schedule", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      downloadText(`givftme-schedule-${toIsoDate(today)}.csv`, await response.text());
      toast("Schedule exported");
    } catch {
      toast("Couldn't export the schedule. Please try again.");
    }
  }, [today, toast]);

  const value: BizDashContextValue = {
    ...data,
    today,
    moments,
    staff,
    clients,
    can: (permission: BusinessPermission) => canBusiness(data.member.role, permission),
    view,
    go,
    upcomingMonth,
    importKind,
    campaignStatus,
    search,
    setSearch,
    openPerson: (kind, person) => setPersonModal({ kind, person }),
    openCampaign: (options = {}) => setCampaignWizard(options),
    openBrief: (options = {}) => setBrief(options),
    run,
    refresh,
    exportSchedule,
    toast,
  };

  const View = VIEWS[view];

  return (
    <BizDashContext.Provider value={value}>
      <div
        style={{ "--company-brand": data.account.brand_color } as CSSProperties}
        // prefers-reduced-motion: every transition runs in 0.01ms.
        className="flex min-h-dvh bg-surface text-ink motion-reduce:**:duration-[0.01ms]!"
      >
        <BizDashSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="min-w-0 flex-1">
          <BizDashTopbar onMenu={() => setMenuOpen(true)} menuOpen={menuOpen} />
          <main className="mx-auto w-full max-w-330 px-4 py-6 md:px-8 md:py-8">
            <View key={view === "import" ? `import-${importKind}` : view} />
          </main>
        </div>
      </div>

      {personModal ? (
        <PersonModal
          key={personModal.person?.id ?? `new-${personModal.kind}`}
          kind={personModal.kind}
          person={personModal.person}
          onClose={() => setPersonModal(null)}
        />
      ) : null}
      {campaignWizard ? (
        <CampaignWizard
          key={campaignWizard.campaign?.id ?? "new"}
          options={campaignWizard}
          onClose={() => setCampaignWizard(null)}
        />
      ) : null}
      {brief ? <BriefModal options={brief} onClose={() => setBrief(null)} /> : null}
    </BizDashContext.Provider>
  );
}

/** Sidebar + topbar + client-side view switcher for /business-dashboard. */
export function BizDashShell({ data, todayIso }: { data: BusinessDashboardData; todayIso: string }) {
  return (
    <ToastProvider>
      <Dashboard data={data} todayIso={todayIso} />
    </ToastProvider>
  );
}
