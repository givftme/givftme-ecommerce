import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Gift, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getWishlistCoverClass, type WishlistCoverKey } from "@/lib/wishlist/covers";

export interface WishlistSidebarEntry {
  key: string;
  href: string;
  title: string;
  cover: WishlistCoverKey | null;
  emoji: string | null;
  itemCount: number;
  /** Second half of the subtitle, e.g. "12 days to go" or "Always open". */
  meta: string;
  current?: boolean;
}

function EntryLink({
  entry,
  muted = false,
}: {
  entry: WishlistSidebarEntry;
  muted?: boolean;
}) {
  return (
    <Link
      href={entry.href}
      aria-current={entry.current ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-[18px] border-[1.5px] bg-white p-2.5 text-left transition-[border-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 lg:hover:translate-x-0.5",
        entry.current ? "border-brand" : "border-transparent hover:border-line"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-xl text-white",
          muted ? "bg-stone-300" : getWishlistCoverClass(entry.cover)
        )}
      >
        {entry.emoji ?? <Gift className="h-5 w-5" strokeWidth={1.75} />}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold text-ink">
          {entry.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {entry.itemCount} {entry.itemCount === 1 ? "item" : "items"} · {entry.meta}
        </span>
      </span>
    </Link>
  );
}

export function WishlistSidebar({
  entries,
  pastEntries,
}: {
  entries: WishlistSidebarEntry[];
  pastEntries: WishlistSidebarEntry[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h2 className="font-display text-[26px] leading-tight text-ink">My wishlists</h2>

      <nav aria-label="My wishlists">
        {/* Mobile and tablet scroll sideways; desktop stacks. */}
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {entries.map((entry) => (
            <li key={entry.key} className="w-58 shrink-0 lg:w-auto">
              <EntryLink entry={entry} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Every extra wishlist belongs to an occasion, so creating one goes
          through the existing occasion flow. */}
      <Link
        href="/my-occasions/new"
        className="flex h-13 items-center justify-center gap-2 rounded-[18px] border-[1.5px] border-dashed border-brand/30 bg-white font-medium text-brand transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New wishlist
      </Link>

      {pastEntries.length > 0 && (
        <details className="group">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-1 text-sm font-medium text-muted hover:text-ink">
            Past wishlists ({pastEntries.length})
            <ChevronDown
              className="h-4 w-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <ul className="mt-1 flex flex-col gap-2">
            {pastEntries.map((entry) => (
              <li key={entry.key}>
                <EntryLink entry={entry} muted />
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="hidden items-center gap-3 rounded-[20px] bg-white p-4 lg:flex">
        <Image
          src="/images/givftme-wave.png"
          alt=""
          width={820}
          height={687}
          sizes="64px"
          className="h-auto w-16 shrink-0"
        />
        <p className="text-[12.5px] leading-snug text-muted">
          <span className="block text-[13px] font-semibold text-ink">Tip</span>
          Lists with 5+ items get used more. Add a mix of prices so everyone can
          give.
        </p>
      </div>
    </div>
  );
}
