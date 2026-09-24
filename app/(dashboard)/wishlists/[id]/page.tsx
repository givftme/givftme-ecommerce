import { notFound, redirect } from "next/navigation";
import { WishlistItemList } from "@/components/wishlist/WishlistItemList";
import {
  WishlistSidebar,
  type WishlistSidebarEntry,
} from "@/components/wishlist/WishlistSidebar";
import type { AddItemMode } from "@/components/wishlist/AddItemSheet";
import { ReactivationPromptsBanner } from "@/components/occasion/ReactivationPromptsBanner";
import { trackEvent } from "@/lib/analytics";
import { OCCASION_EMOJIS } from "@/lib/occasion/constants";
import {
  getOccasionSummaries,
  getUnresolvedOccasionPrompts,
} from "@/lib/occasion/server";
import { getDaysToGoCopy } from "@/lib/wishlist/display";
import {
  getOwnedWishlistDetail,
  getWishlistSummaries,
  requireDashboardUser,
} from "@/lib/wishlist/server";

const ADD_MODES: AddItemMode[] = ["catalog", "url", "manual"];

function parseAddMode(value: string | string[] | undefined) {
  const mode = Array.isArray(value) ? value[0] : value;

  return ADD_MODES.includes(mode as AddItemMode)
    ? (mode as AddItemMode)
    : undefined;
}

export default async function WishlistDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ add?: string | string[] }>;
}) {
  const { id } = await params;
  const { add } = await searchParams;
  const { supabase, user } = await requireDashboardUser(`/wishlists/${id}`);
  const wishlist = await getOwnedWishlistDetail(supabase, user.id, id);

  if (!wishlist) {
    notFound();
  }

  const [summaries, occasions, reactivationPrompts] = await Promise.all([
    getWishlistSummaries(supabase, user.id),
    getOccasionSummaries(supabase, user.id),
    getUnresolvedOccasionPrompts({ supabase, userId: user.id }),
  ]);
  const occasion =
    occasions.find((summary) => summary.wishlist_id === wishlist.id) ?? null;

  // A deleted (archived) list is read-only; its occasion page shows the
  // history and owns reactivation.
  if (occasion?.status === "archived") {
    redirect(`/my-occasions/${occasion.id}`);
  }

  const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));
  const evergreen = summaries.find((summary) => summary.type === "evergreen");
  const entries: WishlistSidebarEntry[] = [
    ...(evergreen
      ? [
          {
            key: evergreen.id,
            href: `/wishlists/${evergreen.id}`,
            title: evergreen.title,
            cover: evergreen.cover_color,
            emoji: null,
            itemCount: evergreen.item_count,
            meta: "Always open",
            current: evergreen.id === wishlist.id,
          },
        ]
      : []),
    ...occasions
      .filter((summary) => summary.status === "active" && summary.wishlist_id)
      .map((summary) => ({
        key: summary.id,
        href: `/wishlists/${summary.wishlist_id}`,
        title: summary.title,
        cover: summaryById.get(summary.wishlist_id ?? "")?.cover_color ?? null,
        emoji: OCCASION_EMOJIS[summary.occasion_type],
        itemCount: summary.item_count,
        meta: getDaysToGoCopy(summary.occasion_date) ?? "",
        current: summary.wishlist_id === wishlist.id,
      })),
  ];
  const pastEntries: WishlistSidebarEntry[] = occasions
    .filter((summary) => summary.status === "archived")
    .map((summary) => ({
      key: summary.id,
      href: `/my-occasions/${summary.id}`,
      title: summary.title,
      cover: null,
      emoji: OCCASION_EMOJIS[summary.occasion_type],
      itemCount: summary.item_count,
      meta: "Archived",
    }));

  trackEvent("wishlist.viewed", {
    wishlist_id: wishlist.id,
    item_count: wishlist.items.length,
  });

  if (reactivationPrompts.length > 0) {
    trackEvent("occasion.reactivation_prompt.shown", {
      occasion_count: reactivationPrompts.length,
    });
  }

  return (
    <WishlistItemList
      key={wishlist.id}
      wishlist={wishlist}
      occasion={occasion}
      initialAddMode={parseAddMode(add)}
      sidebar={<WishlistSidebar entries={entries} pastEntries={pastEntries} />}
      banner={
        reactivationPrompts.length > 0 ? (
          <ReactivationPromptsBanner prompts={reactivationPrompts} />
        ) : undefined
      }
    />
  );
}
