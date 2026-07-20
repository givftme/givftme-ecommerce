import Link from "next/link";
import Image from "next/image";
import { ChevronRight, PartyPopper } from "lucide-react";

export interface OccasionCategory {
  slug: string;
  name?: string;
  title?: string;
  itemCount: number;
  coverImageUrl?: string | null;
  emoji?: string | null;
}

export interface OccasionCategoriesProps {
  occasions: OccasionCategory[];
}

export function OccasionCategories({ occasions }: OccasionCategoriesProps) {
  const hasOccasions = occasions.length > 0;

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-ink">Shop by occasion</h2>
        <Link
          href="/occasions"
          className="hidden items-center gap-1 text-sm text-muted transition-colors hover:text-ink sm:flex"
        >
          Shop all occasions
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {hasOccasions ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {occasions.map((occasion) => {
            const title = occasion.title || occasion.name || "Occasion";

            return (
              <Link
                key={occasion.slug}
                href={`/occasions/${occasion.slug}`}
                className="overflow-hidden rounded-xl border border-stone-200 bg-white text-center transition-colors hover:border-brand"
              >
                <div className="relative aspect-square bg-surface">
                  {occasion.coverImageUrl ? (
                    <Image
                      src={occasion.coverImageUrl}
                      alt={title}
                      fill
                      sizes="(max-width: 768px) 50vw, 16vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">
                      {occasion.emoji || <PartyPopper className="h-7 w-7 text-stone-400" />}
                    </div>
                  )}
                </div>
                <div className="px-3 py-4">
                  <p className="text-sm font-medium text-ink">{title}</p>
                  <p className="text-xs text-muted">{occasion.itemCount} items</p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl bg-surface p-6 text-center text-sm text-muted">
          No occasions available yet - check back soon.
        </p>
      )}

      <div className="mt-8 flex justify-center sm:hidden">
        <Link
          href="/occasions"
          className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          Shop all occasions
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
