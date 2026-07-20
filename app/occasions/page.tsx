import { PageWrapper } from "@/components/layout/PageWrapper";
import { MuseumOccasionGrid } from "@/components/occasion/MuseumOccasionGrid";
import { normalizeOccasion } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { OCCASIONS_QUERY } from "@/lib/sanity/queries";
import type { MuseumOccasion } from "@/lib/sanity/types";

export const revalidate = 60;

export default async function OccasionsPage() {
  const rawOccasions = await sanityFetch<Partial<MuseumOccasion>[]>(
    OCCASIONS_QUERY
  );
  const occasions = rawOccasions.map(normalizeOccasion).filter((item) => item.id);

  return (
    <PageWrapper>
      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase text-brand">
            Gift Museum
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink lg:text-4xl">
            Shop by Occasion
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            Browse editorial gift rooms curated around birthdays, weddings,
            anniversaries, and the moments people remember.
          </p>
        </div>

        {occasions.length > 0 ? (
          <MuseumOccasionGrid occasions={occasions} />
        ) : (
          <p className="rounded-2xl bg-surface p-8 text-center text-sm text-muted">
            No occasions available yet - check back soon.
          </p>
        )}
      </section>
    </PageWrapper>
  );
}
