import { MILESTONE_YEARS, type AudienceLabel, type GiftTier } from "@/lib/business-dashboard/data";
import type {
  BusinessCampaign,
  BusinessPerson,
  PersonKind,
  UpcomingMoment,
} from "@/lib/business-dashboard/types";
import { formatPrice } from "@/lib/utils";

// Pure helpers for the business dashboard. Every date here is a local
// calendar date (midnight), so "in 3 days" means three calendar days in the
// viewer's timezone. Functions that depend on "today" take it as an optional
// last argument so they stay testable.

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(month: number, year: number | null) {
  if (month === 2) return year === null || isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** A month/day in a given year; 29 Feb falls back to 28 Feb outside leap years. */
function dateInYear(year: number, month: number, day: number) {
  return new Date(year, month - 1, Math.min(day, daysInMonth(month, year)));
}

const pad = (value: number) => String(value).padStart(2, "0");

/** `YYYY-MM-DD` for a local date. */
export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A local date from `YYYY-MM-DD` (never parsed as UTC). */
export function fromIsoDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

/** Today's Lagos calendar date as a local Date, for server-side computations. */
export function lagosToday(now: Date = new Date()) {
  return fromIsoDate(now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }));
}

/** `MM-DD` from a month and day. */
export function toMmdd(month: number, day: number) {
  return `${pad(month)}-${pad(day)}`;
}

/** Given 'MM-DD', the next date it falls on (today counts). */
export function nextOccurrence(mmdd: string, today: Date = new Date()): Date {
  const [month, day] = mmdd.split("-").map(Number);
  const base = startOfDay(today);
  const thisYear = dateInYear(base.getFullYear(), month, day);
  return thisYear >= base ? thisYear : dateInYear(base.getFullYear() + 1, month, day);
}

/** Whole calendar days from today to `date` (negative when past). */
export function daysTo(date: Date, today: Date = new Date()): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / DAY_MS);
}

/** 'Ngozi Adeyemi' → 'NA'. */
export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

const AVATAR_PALETTE: [string, string][] = [
  ["#FEF2F2", "#C50404"],
  ["#F4EEFF", "#6B3FD0"],
  ["#EFF6FF", "#1D4ED8"],
  ["#F0FDF4", "#15803D"],
  ["#FFFBEB", "#B45309"],
  ["#FFF4EC", "#C4520A"],
  ["#F5F5F4", "#44403C"],
];

/** Deterministic avatar [background, text] colours from a name. */
export function colorPalette(name: string): [string, string] {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function monthFromName(value: string) {
  const index = MONTHS.indexOf(value.slice(0, 3).toLowerCase());
  return index === -1 ? null : index + 1;
}

function fullYear(value: string | undefined) {
  if (!value) return null;
  const year = Number(value);
  if (!Number.isInteger(year)) return null;
  if (value.length === 2) return year > 30 ? 1900 + year : 2000 + year;
  return value.length === 4 ? year : null;
}

function validDate(mm: number, dd: number, yy: number | null) {
  if (!Number.isInteger(mm) || !Number.isInteger(dd) || mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > daysInMonth(mm, yy)) return null;
  return { mm, dd, yy };
}

/**
 * Reads a date the way Nigerian spreadsheets write them: day first.
 * Accepts DD/MM/YYYY (also - or . separators), YYYY-MM-DD, DD MMM YYYY and
 * MMM DD YYYY. The year is optional everywhere except ISO dates.
 */
export function parseDate(value: string): { mm: number; dd: number; yy: number | null } | null {
  const text = value.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  if (!text) return null;

  // YYYY-MM-DD (optionally with a time part)
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/);
  if (match) return validDate(Number(match[2]), Number(match[3]), Number(match[1]));

  // DD/MM/YYYY, DD-MM-YY, DD.MM, …
  match = text.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2}|\d{4}))?$/);
  if (match) {
    const yy = match[3] ? fullYear(match[3]) : null;
    return validDate(Number(match[2]), Number(match[1]), yy);
  }

  // DD MMM YYYY / DD-MMM-YYYY / 14th March
  match = text.match(/^(\d{1,2})(?:st|nd|rd|th)?[ -]([a-z]{3,9})\.?(?:[ -](\d{2}|\d{4}))?$/i);
  if (match) {
    const mm = monthFromName(match[2]);
    if (!mm) return null;
    return validDate(mm, Number(match[1]), match[3] ? fullYear(match[3]) : null);
  }

  // MMM DD YYYY / March 14th
  match = text.match(/^([a-z]{3,9})\.?[ -](\d{1,2})(?:st|nd|rd|th)?(?:[ -](\d{2}|\d{4}))?$/i);
  if (match) {
    const mm = monthFromName(match[1]);
    if (!mm) return null;
    return validDate(mm, Number(match[2]), match[3] ? fullYear(match[3]) : null);
  }

  return null;
}

/**
 * Full RFC 4180 parser: quoted fields, escaped quotes ("") and line breaks
 * inside quotes. Comma or tab delimited (tab when the first line has more
 * tabs than commas, as Excel copy-paste does). Blank lines are dropped.
 */
export function parseCSV(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows
    .map((cells) => cells.map((cell) => cell.trim()))
    .filter((cells) => cells.some((cell) => cell !== ""));
}

/** ₦12,345 */
export function formatNaira(n: number): string {
  return formatPrice(Number.isFinite(n) ? n : 0);
}

function trimDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

/** ₦12k / ₦1.2m */
export function formatNairaK(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}₦${trimDecimal(abs / 1_000_000_000)}b`;
  if (abs >= 1_000_000) return `${sign}₦${trimDecimal(abs / 1_000_000)}m`;
  if (abs >= 1_000) return `${sign}₦${abs >= 10_000 ? Math.round(abs / 1_000) : trimDecimal(abs / 1_000)}k`;
  return `${sign}₦${Math.round(abs)}`;
}

/** '14 Mar' */
export function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** '14 Mar 2027' */
export function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** '14 Mar' from 'MM-DD'. */
export function formatMmdd(mmdd: string) {
  const [month, day] = mmdd.split("-").map(Number);
  return formatShortDate(new Date(2000, month - 1, day));
}

/** 'today', 'tomorrow', 'in 5 days', '3 days ago'. */
export function formatDaysAway(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** 'YYYY-MM' */
export function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Completed years of service on `onDate` for someone who started on `startDate`. */
export function milestoneYears(startDate: Date, onDate: Date): number {
  let years = onDate.getFullYear() - startDate.getFullYear();
  const anniversary = dateInYear(onDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
  if (startOfDay(onDate) < anniversary) years -= 1;
  return Math.max(0, years);
}

/** The next milestone anniversary (1, 3, 5, 10, 15, 20 years) on or after today. */
export function nextMilestone(startDate: Date, today: Date = new Date()): { years: number; date: Date } | null {
  const base = startOfDay(today);
  for (const years of MILESTONE_YEARS) {
    const date = dateInYear(startDate.getFullYear() + years, startDate.getMonth() + 1, startDate.getDate());
    if (date >= base) return { years, date };
  }
  return null;
}

/** Heads × (per-head budget + delivery fee). */
export function campaignCost(
  campaign: Pick<BusinessCampaign, "heads" | "per_head" | "delivery_fee">,
  deliveryFee: number = campaign.delivery_fee,
): number {
  return Number(campaign.heads) * (Number(campaign.per_head) + Number(deliveryFee));
}

function personSub(person: BusinessPerson) {
  const parts = person.kind === "staff"
    ? [person.department, person.role_title]
    : [person.company, person.relationship];
  return parts.filter(Boolean).join(" · ");
}

/**
 * The upcoming moments engine: staff birthdays, milestone work anniversaries,
 * client birthdays and non-draft campaign deliveries within `limitDays`,
 * soonest first. Nothing in the past is included.
 */
export function upcomingMoments(
  people: BusinessPerson[],
  campaigns: BusinessCampaign[],
  limitDays = 365,
  today: Date = new Date(),
): UpcomingMoment[] {
  const moments: UpcomingMoment[] = [];

  for (const person of people) {
    const date = nextOccurrence(person.bday, today);
    moments.push({
      id: `birthday-${person.id}`,
      type: "birthday",
      label: "Birthday",
      who: person.name,
      sub: personSub(person),
      date,
      days: daysTo(date, today),
      tier: person.tier,
      kind: person.kind,
      occasion: null,
    });

    if (person.kind === "staff" && person.start_date) {
      const milestone = nextMilestone(fromIsoDate(person.start_date), today);
      if (milestone) {
        moments.push({
          id: `anniversary-${person.id}`,
          type: "anniversary",
          label: `${milestone.years} ${milestone.years === 1 ? "year" : "years"}`,
          who: person.name,
          sub: personSub(person),
          date: milestone.date,
          days: daysTo(milestone.date, today),
          tier: person.tier,
          kind: "staff",
          occasion: null,
        });
      }
    }
  }

  for (const campaign of campaigns) {
    if (campaign.status === "Draft") continue;
    const date = fromIsoDate(campaign.delivery_date);
    moments.push({
      id: `campaign-${campaign.id}`,
      type: "campaign",
      label: "Campaign",
      who: campaign.name,
      sub: `${campaign.audience} · ${campaign.heads} ${campaign.heads === 1 ? "person" : "people"}`,
      date,
      days: daysTo(date, today),
      tier: null,
      kind: "campaign",
      occasion: campaign.occasion,
    });
  }

  return moments
    .filter((moment) => moment.days >= 0 && moment.days <= limitDays)
    .sort((a, b) => a.days - b.days || a.who.localeCompare(b.who));
}

function nthWeekday(year: number, monthIndex: number, weekday: number, n: number) {
  const first = new Date(year, monthIndex, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, monthIndex, 1 + offset + (n - 1) * 7);
}

/**
 * A sensible default delivery date for an occasion: the fixed-date ones
 * (Customer Service Week's Monday, Father's Day, Independence Day, mid
 * December for end of year) when still ahead, otherwise 30 days out.
 */
export function suggestedDeliveryDate(occasion: string, today: Date = new Date()): Date {
  const base = startOfDay(today);
  const upcoming = (build: (year: number) => Date) => {
    const thisYear = build(base.getFullYear());
    return thisYear >= base ? thisYear : build(base.getFullYear() + 1);
  };
  switch (occasion) {
    case "Customer Service Week":
      return upcoming((year) => nthWeekday(year, 9, 1, 1));
    case "Father's Day":
      return upcoming((year) => nthWeekday(year, 5, 0, 3));
    case "Independence Day":
      return upcoming((year) => new Date(year, 9, 1));
    case "End of year":
      return upcoming((year) => new Date(year, 11, 15));
    default:
      return new Date(base.getFullYear(), base.getMonth(), base.getDate() + 30);
  }
}

// --- CSV import -----------------------------------------------------------

export const STAFF_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "bday", label: "Birthday", required: true },
  { key: "department", label: "Department", required: false },
  { key: "role_title", label: "Role", required: false },
  { key: "start_date", label: "Start date", required: false },
] as const;

export const CLIENT_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "bday", label: "Birthday", required: true },
  { key: "company", label: "Company", required: false },
  { key: "relationship", label: "Relationship", required: false },
  { key: "account_owner", label: "Account owner", required: false },
] as const;

export type ImportField =
  | (typeof STAFF_FIELDS)[number]["key"]
  | (typeof CLIENT_FIELDS)[number]["key"];

export function importFields(kind: PersonKind) {
  return kind === "staff" ? STAFF_FIELDS : CLIENT_FIELDS;
}

const FIELD_SYNONYMS: Record<ImportField, string[]> = {
  name: ["name", "full name", "fullname", "staff name", "employee", "employee name", "client name", "contact", "contact name"],
  bday: ["birthday", "bday", "birth day", "date of birth", "dob", "birth date", "birthdate"],
  department: ["department", "dept", "team", "unit", "division"],
  role_title: ["role", "title", "job title", "position", "designation", "job role"],
  start_date: ["start date", "start", "date joined", "joined", "hire date", "employment date", "resumption date", "date of employment"],
  company: ["company", "organisation", "organization", "business", "firm", "company name"],
  relationship: ["relationship", "type", "category"],
  account_owner: ["account owner", "owner", "account manager", "relationship manager", "manager"],
};

const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Best-guess column index per field from the header row (-1 when absent). */
export function guessColumnMap(headers: string[], kind: PersonKind): Record<string, number> {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const map: Record<string, number> = {};

  for (const field of importFields(kind)) {
    const synonyms = FIELD_SYNONYMS[field.key];
    let index = normalized.findIndex((header, i) => !used.has(i) && synonyms.includes(header));
    if (index === -1) {
      index = normalized.findIndex(
        (header, i) => !used.has(i) && synonyms.some((synonym) => synonym.length > 3 && header.includes(synonym)),
      );
    }
    if (index !== -1) used.add(index);
    map[field.key] = index;
  }
  return map;
}

export interface ImportPerson {
  name: string;
  bday: string;
  tier: GiftTier;
  department: string | null;
  role_title: string | null;
  start_date: string | null;
  company: string | null;
  relationship: string | null;
  account_owner: string | null;
}

export interface ImportProblem {
  row: number;
  name: string;
  reason: string;
}

export interface ImportValidation {
  ok: ImportPerson[];
  bad: ImportProblem[];
  dupes: ImportProblem[];
}

/** Fields the column map still needs before an import can run. */
export function missingRequiredFields(map: Record<string, number>, kind: PersonKind) {
  return importFields(kind)
    .filter((field) => field.required && (map[field.key] ?? -1) < 0)
    .map((field) => field.label);
}

/**
 * Splits data rows (header excluded) into importable people, rows with
 * problems (no name, unreadable birthday) and duplicates by name, matched
 * case-insensitively against `existing` names and earlier rows in the file.
 * Row numbers are spreadsheet rows, so the header is row 1.
 */
export function validateImportRows(
  rows: string[][],
  _headers: string[],
  map: Record<string, number>,
  kind: PersonKind,
  existing: string[],
): ImportValidation {
  const seen = new Set(existing.map((name) => name.trim().toLowerCase()));
  const result: ImportValidation = { ok: [], bad: [], dupes: [] };
  const cell = (row: string[], key: string) => {
    const index = map[key] ?? -1;
    return index >= 0 ? (row[index] ?? "").trim() : "";
  };

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = cell(row, "name").replace(/\s+/g, " ");
    const rawBday = cell(row, "bday");

    if (!name) {
      result.bad.push({ row: rowNumber, name: "", reason: "Missing name" });
      return;
    }
    // Same bounds as personSchema, so one bad row can't fail the whole import.
    if (name.length < 2 || name.length > 100) {
      result.bad.push({ row: rowNumber, name: name.slice(0, 40), reason: "Name must be 2 to 100 characters" });
      return;
    }
    const bday = parseDate(rawBday);
    if (!bday) {
      result.bad.push({
        row: rowNumber,
        name,
        reason: rawBday ? `Couldn't read the birthday "${rawBday}"` : "Missing birthday",
      });
      return;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      result.dupes.push({ row: rowNumber, name, reason: "Already on file" });
      return;
    }
    seen.add(key);

    const start = kind === "staff" ? parseDate(cell(row, "start_date")) : null;
    result.ok.push({
      name,
      bday: toMmdd(bday.mm, bday.dd),
      tier: "Standard",
      department: kind === "staff" ? cell(row, "department") || "Unassigned" : null,
      role_title: kind === "staff" ? cell(row, "role_title") || null : null,
      start_date: start?.yy ? toIsoDate(dateInYear(start.yy, start.mm, start.dd)) : null,
      company: kind === "client" ? cell(row, "company") || null : null,
      relationship: kind === "client" ? cell(row, "relationship") || "Client" : null,
      account_owner: kind === "client" ? cell(row, "account_owner") || null : null,
    });
  });

  return result;
}

// --- CSV output -----------------------------------------------------------

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** The year schedule export: Date, Type, Name, Details, Days away. */
export function scheduleCsv(moments: UpcomingMoment[]) {
  return toCsv([
    ["Date", "Type", "Name", "Details", "Days away"],
    ...moments.map((moment) => [toIsoDate(moment.date), moment.label, moment.who, moment.sub, moment.days]),
  ]);
}

export function importTemplateCsv(kind: PersonKind) {
  return kind === "staff"
    ? toCsv([
        ["Name", "Birthday", "Department", "Role", "Start date"],
        ["Ngozi Adeyemi", "14/03/1990", "Finance", "Senior Accountant", "02/05/2019"],
        ["Emeka Okafor", "28 Aug", "Sales", "Account Executive", "10/01/2022"],
      ])
    : toCsv([
        ["Name", "Birthday", "Company", "Relationship", "Account owner"],
        ["Funke Bello", "03/11", "Lagos Logistics Ltd", "Client", "Tunde Ade"],
      ]);
}

// --- Audiences ------------------------------------------------------------

/**
 * Heads for a campaign audience, from the people on file. There is no gender
 * or parenthood data, so the parents' audiences start from half the staff
 * list for HR to correct.
 */
export function audienceHeads(audience: AudienceLabel | string, people: BusinessPerson[], department?: string) {
  const staff = people.filter((person) => person.kind === "staff");
  switch (audience) {
    case "Everyone":
      return staff.length;
    case "One department":
      return staff.filter((person) => (person.department || "Unassigned") === department).length;
    case "Staff who are mothers":
    case "Staff who are fathers":
      return Math.ceil(staff.length / 2);
    case "Clients and partners":
      return people.filter((person) => person.kind === "client").length;
    case "Executives":
      return staff.filter((person) => person.department === "Executive").length;
    default:
      return 0;
  }
}

/** Triggers a browser download of text content via a Blob URL. */
export function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
