import Link from "next/link";
import { ChevronRight, PartyPopper } from "lucide-react";

export interface OccasionCategory {
  slug: string;
  name: string;
  itemCount: number;
}

export interface OccasionCategoriesProps {
  occasions: OccasionCategory[];
}

export function OccasionCategories({ occasions }: OccasionCategoriesProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {occasions.map((occasion) => (
          <Link
            key={occasion.slug}
            href={`/occasions/${occasion.slug}`}
            className="flex flex-col items-center gap-3 rounded-xl border border-stone-200 px-3 py-6 text-center transition-colors hover:border-brand"
          >
            <PartyPopper className="h-7 w-7 text-stone-400" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium text-ink">{occasion.name}</p>
              <p className="text-xs text-muted">{occasion.itemCount} items</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          href="/shop"
          className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          Shop all categories
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
