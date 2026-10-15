"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Megaphone, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Avatar, Card, Checkbox, DaysChip, EmptyState, Select, TierPill, ViewHeader } from "@/components/business-dashboard/BizUi";
import { Button } from "@/components/ui/Button";
import { deletePerson, setPeopleTier } from "@/lib/business-dashboard/actions";
import { TIERS, type GiftTier } from "@/lib/business-dashboard/data";
import type { BusinessPerson, PersonKind } from "@/lib/business-dashboard/types";
import {
  daysTo,
  formatLongDate,
  formatMmdd,
  formatShortDate,
  fromIsoDate,
  nextMilestone,
  nextOccurrence,
} from "@/lib/business-dashboard/utils";

interface Column {
  key: string;
  label: string;
  render: (person: BusinessPerson) => ReactNode;
}

/**
 * The Staff and Clients & partners tables: a filter, select-all, per-row
 * checkboxes, a bulk actions bar and an edit button per row.
 */
export function BizPeopleTable({
  kind,
  title,
  description,
  filterLabel,
  filterValue,
  filterOptions,
}: {
  kind: PersonKind;
  title: string;
  description: string;
  filterLabel: string;
  filterValue: (person: BusinessPerson) => string;
  filterOptions: string[];
}) {
  const { account, staff, clients, today, search, can, go, run, openPerson, openCampaign } = useBizDash();
  const people = kind === "staff" ? staff : clients;
  const editable = can("edit_people");

  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tier, setTier] = useState<GiftTier>("Premium");
  const [busy, setBusy] = useState(false);

  const query = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      people.filter(
        (person) =>
          (filter === "All" || filterValue(person) === filter) &&
          (!query ||
            [person.name, person.department, person.role_title, person.company, person.relationship, person.account_owner]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(query)),
      ),
    [people, filter, filterValue, query],
  );

  // Selection only ever covers rows still on screen.
  const visibleSelected = rows.filter((person) => selected.has(person.id));
  const allSelected = rows.length > 0 && visibleSelected.length === rows.length;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bulk = async (action: () => Promise<{ ok: boolean }>) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) setSelected(new Set());
  };

  const ids = visibleSelected.map((person) => person.id);
  const filterOptionsWithCounts = filterOptions.filter((option) => people.some((person) => filterValue(person) === option));

  const columns: Column[] =
    kind === "staff"
      ? [
          { key: "department", label: "Department", render: (person) => person.department || "Unassigned" },
          { key: "role", label: "Role", render: (person) => person.role_title || "—" },
          { key: "birthday", label: "Birthday", render: (person) => <Birthday person={person} today={today} /> },
          {
            key: "start",
            label: "Start date",
            render: (person) => (person.start_date ? formatLongDate(fromIsoDate(person.start_date)) : "—"),
          },
          {
            key: "milestone",
            label: "Next milestone",
            render: (person) => {
              const milestone = person.start_date ? nextMilestone(fromIsoDate(person.start_date), today) : null;
              return milestone ? `${milestone.years} ${milestone.years === 1 ? "year" : "years"} · ${formatShortDate(milestone.date)}` : "—";
            },
          },
        ]
      : [
          { key: "company", label: "Company", render: (person) => person.company || "—" },
          { key: "relationship", label: "Relationship", render: (person) => person.relationship || "Client" },
          { key: "birthday", label: "Birthday", render: (person) => <Birthday person={person} today={today} /> },
          { key: "owner", label: "Account owner", render: (person) => person.account_owner || "—" },
        ];

  return (
    <>
      <ViewHeader
        title={title}
        description={description}
        actions={
          editable ? (
            <>
              <Button variant="outline" size="sm" onClick={() => go("import", { importKind: kind })}>
                <Upload aria-hidden="true" className="h-4 w-4" /> Bulk upload
              </Button>
              <Button size="sm" onClick={() => openPerson(kind)}>
                <Plus aria-hidden="true" className="h-4 w-4" /> Add one
              </Button>
            </>
          ) : null
        }
      />

      <Card bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 md:px-5">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="shrink-0">{filterLabel}</span>
            <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-9 w-auto min-w-40">
              <option value="All">All</option>
              {filterOptionsWithCounts.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </label>
          <span className="ml-auto text-xs text-muted">
            {rows.length} of {people.length} {kind === "staff" ? "staff" : "clients and partners"}
          </span>
        </div>

        {editable && visibleSelected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-light/60 px-4 py-2.5 md:px-5">
            <span className="mr-1 text-sm font-semibold text-ink">{visibleSelected.length} selected</span>
            <label className="flex items-center gap-2">
              <span className="sr-only">Gift tier</span>
              <Select
                value={tier}
                onChange={(event) => setTier(event.target.value as GiftTier)}
                className="h-9 w-auto"
              >
                {TIERS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                bulk(() =>
                  run(
                    () => setPeopleTier(account.id, ids, tier),
                    (data) => `${data.updated} set to ${tier}`,
                  ),
                )
              }
            >
              Set gift tier
            </Button>
            {can("edit_campaigns") ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  openCampaign({
                    heads: visibleSelected.length,
                    audience: kind === "staff" ? "Everyone" : "Clients and partners",
                  })
                }
              >
                <Megaphone aria-hidden="true" className="h-4 w-4" /> Add to a campaign
              </Button>
            ) : null}
            <Button
              variant="text"
              size="sm"
              disabled={busy}
              className="text-danger"
              onClick={() => {
                if (!window.confirm(`Remove ${visibleSelected.length} ${visibleSelected.length === 1 ? "person" : "people"}?`)) return;
                bulk(() => run(() => deletePerson(account.id, ids), (data) => `${data.removed} removed`));
              }}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" /> Remove
            </Button>
          </div>
        ) : null}

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-border">
                  {editable ? (
                    <th scope="col" className="w-10 py-3 pl-4 md:pl-5">
                      <Checkbox
                        aria-label="Select all"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(allSelected ? new Set() : new Set(rows.map((person) => person.id)))
                        }
                      />
                    </th>
                  ) : null}
                  <th scope="col" className="px-3 py-3 font-medium">Name</th>
                  {columns.map((column) => (
                    <th key={column.key} scope="col" className="px-3 py-3 font-medium">{column.label}</th>
                  ))}
                  <th scope="col" className="px-3 py-3 font-medium">Gift tier</th>
                  {editable ? <th scope="col" className="w-12 py-3 pr-4 md:pr-5"><span className="sr-only">Edit</span></th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((person) => (
                  <tr key={person.id} className={selected.has(person.id) ? "bg-brand-light/40" : undefined}>
                    {editable ? (
                      <td className="py-3 pl-4 md:pl-5">
                        <Checkbox
                          aria-label={`Select ${person.name}`}
                          checked={selected.has(person.id)}
                          onChange={() => toggle(person.id)}
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={person.name} className="h-8 w-8 text-[11px]" />
                        <span className="font-semibold text-ink">{person.name}</span>
                      </div>
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} className="px-3 py-3 text-ink">{column.render(person)}</td>
                    ))}
                    <td className="px-3 py-3"><TierPill tier={person.tier} /></td>
                    {editable ? (
                      <td className="py-3 pr-4 md:pr-5">
                        <button
                          type="button"
                          onClick={() => openPerson(kind, person)}
                          aria-label={`Edit ${person.name}`}
                          className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={people.length ? "No one matches" : kind === "staff" ? "No staff on file yet" : "No clients or partners yet"}
            action={
              !people.length && editable ? (
                <Button variant="outline" size="sm" onClick={() => go("import", { importKind: kind })}>
                  <Upload aria-hidden="true" className="h-4 w-4" /> Upload a list
                </Button>
              ) : null
            }
          >
            {people.length ? "Try another filter or search." : "Upload a CSV or paste rows from Excel."}
          </EmptyState>
        )}
      </Card>
    </>
  );
}

function Birthday({ person, today }: { person: BusinessPerson; today: Date }) {
  const days = daysTo(nextOccurrence(person.bday, today), today);
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      {formatMmdd(person.bday)}
      <DaysChip days={days} />
    </span>
  );
}
