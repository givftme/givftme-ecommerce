import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ProductExplorer } from "@/components/collection/ProductExplorer";
import { MuseumOccasionGrid } from "@/components/occasion/MuseumOccasionGrid";
import { TrackView } from "@/components/shared/TrackView";
import { normalizeOccasion, normalizeProductCards } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { OCCASIONS_QUERY, PRODUCT_SEARCH_QUERY } from "@/lib/sanity/queries";
import type { MuseumOccasion, ProductCardData } from "@/lib/sanity/types";

export const revalidate = 60;

function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = (getQueryValue(params.q) || "").trim();

  if (!query) {
    redirect("/shop");
  }

  const [rawProducts, rawOccasions] = await Promise.all([
    sanityFetch<ProductCardData[]>(PRODUCT_SEARCH_QUERY, {
      query,
      term: `*${query}*`,
    }),
    sanityFetch<Partial<MuseumOccasion>[]>(OCCASIONS_QUERY),
  ]);
  const products = normalizeProductCards(rawProducts);
  const suggestionOccasions = rawOccasions
    .map(normalizeOccasion)
    .filter((occasion) => occasion.id)
    .slice(0, 3);

  return (
    <PageWrapper searchQuery={query}>
      <TrackView
        event={products.length > 0 ? "museum.search.submitted" : "museum.search.no_results"}
        properties={{ query, result_count: products.length }}
      />
      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-ink lg:text-4xl">
            Results for &quot;{query}&quot;
          </h1>
          <p className="mt-3 text-sm text-muted">
            {products.length} {products.length === 1 ? "result" : "results"}
          </p>
        </header>

        {products.length > 0 ? (
          <ProductExplorer initialProducts={products} totalProducts={products.length} />
        ) : (
          <div className="space-y-10">
            <div className="rounded-2xl bg-surface p-8 text-center">
              <p className="text-sm text-muted">No products found for &quot;{query}&quot;</p>
              <Link
                href="/shop"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand"
              >
                Browse all gifts
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {suggestionOccasions.length > 0 ? (
              <div>
                <h2 className="mb-6 text-2xl font-semibold text-ink">
                  Browse occasions
                </h2>
                <MuseumOccasionGrid occasions={suggestionOccasions} />
              </div>
            ) : null}
          </div>
        )}
      </section>
    </PageWrapper>
  );
}
