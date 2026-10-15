"use client";

import { createContext, useContext } from "react";
import type { CampaignStatus } from "@/lib/business-dashboard/data";
import type { BusinessPermission } from "@/lib/business-dashboard/permissions";
import type {
  ActionResult,
  BusinessCampaign,
  BusinessDashboardData,
  BusinessPerson,
  PersonKind,
  UpcomingMoment,
} from "@/lib/business-dashboard/types";

export const BIZ_VIEWS = [
  "overview",
  "upcoming",
  "staff",
  "clients",
  "import",
  "campaigns",
  "calendar",
  "rules",
  "proof",
  "budget",
  "brand",
  "team",
] as const;

export type BizView = (typeof BIZ_VIEWS)[number];

export interface GoOptions {
  /** Upcoming view filtered to one 'YYYY-MM' month (from the calendar). */
  month?: string | null;
  importKind?: PersonKind;
  campaignStatus?: CampaignStatus | "All";
}

export interface CampaignWizardOptions {
  campaign?: BusinessCampaign;
  occasion?: string;
  heads?: number;
  audience?: string;
}

export interface BriefOptions {
  occasion?: string;
  heads?: number;
  neededBy?: string;
  notes?: string;
}

export interface BizDashContextValue extends BusinessDashboardData {
  today: Date;
  /** Every moment in the next 365 days. */
  moments: UpcomingMoment[];
  staff: BusinessPerson[];
  clients: BusinessPerson[];
  can: (permission: BusinessPermission) => boolean;
  view: BizView;
  go: (view: BizView, options?: GoOptions) => void;
  upcomingMonth: string | null;
  importKind: PersonKind;
  campaignStatus: CampaignStatus | "All";
  search: string;
  setSearch: (value: string) => void;
  openPerson: (kind: PersonKind, person?: BusinessPerson) => void;
  openCampaign: (options?: CampaignWizardOptions) => void;
  openBrief: (options?: BriefOptions) => void;
  /**
   * Runs a server action: toasts its error (or `success`), refreshes the
   * server data on success, and returns the result.
   */
  run: <T>(
    action: () => Promise<ActionResult<T>>,
    success?: string | ((data: T) => string),
  ) => Promise<ActionResult<T>>;
  refresh: () => void;
  exportSchedule: () => Promise<void>;
  toast: (message: string) => void;
}

export const BizDashContext = createContext<BizDashContextValue | null>(null);

export function useBizDash() {
  const value = useContext(BizDashContext);
  if (!value) throw new Error("useBizDash must be used within BizDashShell");
  return value;
}
