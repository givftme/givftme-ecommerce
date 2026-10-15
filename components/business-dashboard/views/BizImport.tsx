"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Card, EmptyState, Select, StatCard, Steps, ViewHeader } from "@/components/business-dashboard/BizUi";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { SAVE_FAILED_MESSAGE } from "@/lib/business-dashboard/permissions";
import type { PersonKind } from "@/lib/business-dashboard/types";
import {
  downloadText,
  formatMmdd,
  guessColumnMap,
  importFields,
  importTemplateCsv,
  missingRequiredFields,
  parseCSV,
  validateImportRows,
} from "@/lib/business-dashboard/utils";
import { MAX_IMPORT_ROWS } from "@/lib/business-dashboard/validation";
import { cn } from "@/lib/utils";

const STEPS = ["Upload", "Map columns", "Review & import"] as const;

interface Parsed {
  headers: string[];
  rows: string[][];
  source: string;
}

/** Bulk upload: drop or paste → map columns → review and import. */
export function BizImport() {
  const { importKind, staff, clients, can, go, toast, refresh } = useBizDash();
  const [kind, setKind] = useState<PersonKind>(importKind);
  const [step, setStep] = useState(0);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [paste, setPaste] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const existing = useMemo(() => (kind === "staff" ? staff : clients).map((person) => person.name), [kind, staff, clients]);
  const missing = missingRequiredFields(map, kind);
  const review = useMemo(
    () => (parsed && step === 2 ? validateImportRows(parsed.rows, parsed.headers, map, kind, existing) : null),
    [parsed, step, map, kind, existing],
  );

  if (!can("edit_people")) {
    return (
      <>
        <ViewHeader title="Bulk upload" />
        <Card>
          <EmptyState title="You don't have permission to do that.">Ask an admin or editor to upload the list.</EmptyState>
        </Card>
      </>
    );
  }

  const reset = (nextKind: PersonKind = kind) => {
    setKind(nextKind);
    setStep(0);
    setParsed(null);
    setMap({});
    setPaste("");
  };

  const load = (text: string, source: string) => {
    const rows = parseCSV(text);
    if (rows.length < 2) {
      toast("That file looks empty");
      return;
    }
    const [headers, ...data] = rows;
    setParsed({ headers, rows: data, source });
    setMap(guessColumnMap(headers, kind));
    setStep(1);
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      toast("Upload a CSV file. In Excel: File → Save As → CSV.");
      return;
    }
    load(await file.text(), file.name);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files[0]);
  };

  const runImport = async () => {
    if (!review?.ok.length) return;
    if (review.ok.length > MAX_IMPORT_ROWS) {
      toast(`Upload at most ${MAX_IMPORT_ROWS.toLocaleString()} people at a time.`);
      return;
    }
    setImporting(true);
    try {
      const response = await fetch("/api/business-dashboard/people/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, people: review.ok }),
      });
      const body = (await response.json().catch(() => null)) as { inserted?: number; error?: string } | null;
      if (!response.ok) {
        toast(body?.error || SAVE_FAILED_MESSAGE);
        return;
      }
      const inserted = body?.inserted ?? 0;
      toast(`Imported ${inserted} ${inserted === 1 ? "person" : "people"}`);
      refresh();
      reset();
      go(kind === "staff" ? "staff" : "clients");
    } catch {
      toast(SAVE_FAILED_MESSAGE);
    } finally {
      setImporting(false);
    }
  };

  const fields = importFields(kind);

  return (
    <>
      <ViewHeader
        title="Bulk upload"
        description="Upload your list once. We'll remember everybody's day."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadText(`givftme-${kind}-template.csv`, importTemplateCsv(kind))}
          >
            <Download aria-hidden="true" className="h-4 w-4" /> Download template
          </Button>
        }
      />

      <Card>
        <Steps steps={STEPS} current={step} />

        {step === 0 ? (
          <div className="flex flex-col gap-5">
            <div role="tablist" aria-label="List type" className="inline-flex w-fit rounded-full bg-surface p-1">
              {(["staff", "client"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={kind === option}
                  onClick={() => reset(option)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    kind === option ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
                  )}
                >
                  {option === "staff" ? "Staff" : "Clients"}
                </button>
              ))}
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                dragging ? "border-brand bg-brand-light" : "border-line bg-surface",
              )}
            >
              <FileSpreadsheet aria-hidden="true" className="h-10 w-10 text-brand" />
              <div>
                <p className="text-base font-semibold text-ink">Drop your CSV here</p>
                <p className="mt-1 text-sm text-muted">
                  {kind === "staff"
                    ? "Name and birthday are all we need. Department, role and start date help."
                    : "Name and birthday are all we need. Company, relationship and owner help."}
                </p>
              </div>
              <Button size="sm" onClick={() => fileInput.current?.click()}>
                <Upload aria-hidden="true" className="h-4 w-4" /> Choose a file
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  void readFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>

            <details className="group rounded-2xl border border-border px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Or paste rows from Excel</summary>
              <div className="mt-3 flex flex-col gap-3">
                <label htmlFor="biz-paste" className="text-xs text-muted">
                  Copy the cells including the header row, then paste them here.
                </label>
                <Textarea
                  id="biz-paste"
                  value={paste}
                  onChange={(event) => setPaste(event.target.value)}
                  placeholder={"Name\tBirthday\tDepartment\nNgozi Adeyemi\t14/03/1990\tFinance"}
                  className="min-h-36 font-mono text-xs"
                />
                <Button variant="outline" size="sm" className="w-fit" disabled={!paste.trim()} onClick={() => load(paste, "Pasted rows")}>
                  Use these rows
                </Button>
              </div>
            </details>
          </div>
        ) : null}

        {step === 1 && parsed ? (
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{parsed.source}</span> · {parsed.rows.length}{" "}
              {parsed.rows.length === 1 ? "row" : "rows"}. We matched what we could; check each field.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 min-[1001px]:grid-cols-3">
              {fields.map((field) => {
                const unmapped = field.required && (map[field.key] ?? -1) < 0;
                return (
                  <div
                    key={field.key}
                    className={cn("rounded-2xl border p-3", unmapped ? "border-danger/40 bg-brand-light/50" : "border-border")}
                  >
                    <label htmlFor={`map-${field.key}`} className="flex items-center justify-between text-sm font-semibold text-ink">
                      {field.label}
                      <span className="text-[11px] font-medium text-muted">{field.required ? "Required" : "Optional"}</span>
                    </label>
                    <p className="mb-1.5 mt-1 text-xs text-muted">from</p>
                    <Select
                      id={`map-${field.key}`}
                      value={map[field.key] ?? -1}
                      onChange={(event) => setMap((current) => ({ ...current, [field.key]: Number(event.target.value) }))}
                      className="h-10"
                    >
                      <option value={-1}>Not in my file</option>
                      {parsed.headers.map((header, index) => (
                        <option key={`${header}-${index}`} value={index}>
                          {header || `Column ${index + 1}`}
                        </option>
                      ))}
                    </Select>
                  </div>
                );
              })}
            </div>

            {missing.length ? (
              <p role="alert" className="flex items-center gap-2 text-sm font-medium text-danger">
                <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                Map {missing.join(" and ")} to continue.
              </p>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Preview</h3>
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-surface text-muted">
                    <tr>
                      {parsed.headers.map((header, index) => (
                        <th key={`${header}-${index}`} scope="col" className="px-3 py-2 font-medium">{header || `Column ${index + 1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsed.rows.slice(0, 4).map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {parsed.headers.map((_, index) => (
                          <td key={index} className="px-3 py-2 text-ink">{row[index] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => reset()}>
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Start again
              </Button>
              <Button size="sm" disabled={missing.length > 0} onClick={() => setStep(2)}>
                Review <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 && review ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard label="Good rows" value={review.ok.length} hint="Ready to import" />
              <StatCard label="Duplicates skipped" value={review.dupes.length} hint="Same name already on file" />
              <StatCard label="Rows with problems" value={review.bad.length} hint="Not imported" />
            </div>

            {review.bad.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber/30 dark:bg-amber/10">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber">
                  <AlertTriangle aria-hidden="true" className="h-4 w-4" /> These rows won&apos;t be imported
                </h3>
                <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber">
                  {review.bad.slice(0, 20).map((problem) => (
                    <li key={problem.row}>
                      Row {problem.row}
                      {problem.name ? ` (${problem.name})` : ""}: {problem.reason}
                    </li>
                  ))}
                  {review.bad.length > 20 ? <li>…and {review.bad.length - 20} more</li> : null}
                </ul>
              </div>
            ) : null}

            {review.ok.length ? (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-surface text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Name</th>
                      <th scope="col" className="px-3 py-2 font-medium">Birthday</th>
                      {kind === "staff" ? (
                        <>
                          <th scope="col" className="px-3 py-2 font-medium">Department</th>
                          <th scope="col" className="px-3 py-2 font-medium">Role</th>
                          <th scope="col" className="px-3 py-2 font-medium">Start date</th>
                        </>
                      ) : (
                        <>
                          <th scope="col" className="px-3 py-2 font-medium">Company</th>
                          <th scope="col" className="px-3 py-2 font-medium">Relationship</th>
                          <th scope="col" className="px-3 py-2 font-medium">Account owner</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {review.ok.slice(0, 8).map((person) => (
                      <tr key={person.name}>
                        <td className="px-3 py-2 font-semibold text-ink">{person.name}</td>
                        <td className="px-3 py-2">{formatMmdd(person.bday)}</td>
                        {kind === "staff" ? (
                          <>
                            <td className="px-3 py-2">{person.department}</td>
                            <td className="px-3 py-2">{person.role_title || "—"}</td>
                            <td className="px-3 py-2">{person.start_date || "—"}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2">{person.company || "—"}</td>
                            <td className="px-3 py-2">{person.relationship}</td>
                            <td className="px-3 py-2">{person.account_owner || "—"}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {review.ok.length > 8 ? (
                  <p className="border-t border-border px-3 py-2 text-xs text-muted">and {review.ok.length - 8} more</p>
                ) : null}
              </div>
            ) : (
              <EmptyState title="Nothing new to import">Every row was a duplicate or had a problem.</EmptyState>
            )}

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)} disabled={importing}>
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to mapping
              </Button>
              <Button size="sm" onClick={runImport} disabled={importing || !review.ok.length}>
                {importing ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                )}
                Import {review.ok.length} {review.ok.length === 1 ? "person" : "people"}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </>
  );
}
