import Image from "next/image";
import { notFound } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { CollectionGrid } from "@/components/collection/CollectionGrid";
import { TrackView } from "@/components/shared/TrackView";
import { normalizeCollection, normalizeOccasion } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { OCCASION_PAGE_QUERY } from "@/lib/sanity/queries";
import type { MuseumCollection, MuseumOccasion } from "@/lib/sanity/types";

export const revalidate = 60;

interface OccasionPageData extends Partial<MuseumOccasion> {
  collections?: Partial<MuseumCollection>[];
}

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const rawOccasion = await sanityFetch<OccasionPageData | null>(
    OCCASION_PAGE_QUERY,
    { slug }
  );

  if (!rawOccasion) {
    notFound();
  }

  const occasion = normalizeOccasion(rawOccasion);
  const collections = (rawOccasion.collections || [])
    .map((collection) =>
      normalizeCollection({
        ...collection,
        occasion: {
          id: occasion.id,
          title: occasion.title,
          slug: occasion.slug,
          emoji: occasion.emoji,
          occasionType: occasion.occasionType,
        },
      })
    )
    .filter((collection) => collection.id);

  return (
    <PageWrapper>
      <TrackView
        event="museum.occasion.viewed"
        properties={{
          occasion_slug: occasion.slug,
          collection_count: collections.length,
        }}
      />
      <section className="relative h-[40vh] min-h-[320px] overflow-hidden bg-ink md:h-[50vh]">
        {occasion.coverImageUrl ? (
          <Image
            src={occasion.coverImageUrl}
            alt={occasion.title}
            fill
            sizes="100vw"
            className="object-cover"
            preload
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-10 text-white lg:px-8">
          <div className="text-5xl">{occasion.emoji || "🎁"}</div>
          <h1 className="mt-3 text-4xl font-bold lg:text-5xl">
            {occasion.title}
          </h1>
          {occasion.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85">
              {occasion.description}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <h2 className="text-2xl font-semibold text-ink">Browse collections</h2>
        <div className="mt-8">
          {collections.length > 0 ? (
            <CollectionGrid collections={collections} />
          ) : (
            <p className="rounded-2xl bg-surface p-8 text-center text-sm text-muted">
              Collections coming soon for this occasion.
            </p>
          )}
        </div>
      </section>
    </PageWrapper>
  );
}
