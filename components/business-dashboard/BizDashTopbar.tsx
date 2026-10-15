"use client";

import { Menu, Plus, Search, UserPlus } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Button } from "@/components/ui/Button";

const SEARCHABLE = new Set(["staff", "clients", "upcoming", "campaigns"]);

/** Search, Add person and New campaign. */
export function BizDashTopbar({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  const { search, setSearch, view, go, can, openPerson, openCampaign } = useBizDash();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-2 px-4 md:gap-3 md:px-6">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          aria-controls="biz-sidebar"
          aria-expanded={menuOpen}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand min-[1001px]:hidden"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>

        <form
          role="search"
          className="relative min-w-0 flex-1 md:max-w-md"
          onSubmit={(event) => {
            event.preventDefault();
            if (!SEARCHABLE.has(view)) go("staff");
          }}
        >
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <label htmlFor="biz-search" className="sr-only">Search people and campaigns</label>
          <input
            id="biz-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search people, teams, campaigns…"
            className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-4 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {can("edit_people") ? (
            <Button variant="outline" size="sm" onClick={() => openPerson(view === "clients" ? "client" : "staff")}>
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              <span className="max-sm:sr-only">Add person</span>
            </Button>
          ) : null}
          {can("edit_campaigns") ? (
            <Button size="sm" onClick={() => openCampaign()}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span className="max-sm:sr-only">New campaign</span>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
