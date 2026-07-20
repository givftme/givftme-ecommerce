import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { ProductExplorer } from "@/components/collection/ProductExplorer";
import { TrackView } from "@/components/shared/TrackView";
import { normalizeCollection, normalizeProductCards } from "@/lib/sanity/catalog";
import { sanityFetch } from "@/lib/sanity/fetch";
import { COLLECTION_PAGE_QUERY } from "@/lib/sanity/queries";
import type { MuseumCollection, ProductCardData } from "@/lib/sanity/types";

export const revalidate = 60;

interface CollectionPageData extends Partial<MuseumCollection> {
  totalProducts?: number;
  products?: ProductCardData[];
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const rawCollection = await sanityFetch<CollectionPageData | null>(
    COLLECTION_PAGE_QUERY,
    { slug, offset: 0, limit: 12 }
  );

  if (!rawCollection) {
    notFound();
  }

  const collection = normalizeCollection(rawCollection);
  const products = normalizeProductCards(rawCollection.products || []);
  const totalProducts = rawCollection.totalProducts || products.length;
  const end = Math.min(products.length, totalProducts);

  return (
    <PageWrapper>
      <TrackView
        event="museum.collection.viewed"
        properties={{
          collection_slug: collection.slug,
          occasion_slug: collection.occasion?.slug || null,
          product_count: totalProducts,
        }}
      />
      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <nav className="mb-8 hidden items-center gap-2 text-sm text-muted md:flex">
          <Link href="/" className="hover:text-brand">
            Home
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/occasions" className="hover:text-brand">
            Occasions
          </Link>
          {collection.occasion ? (
            <>
              <ChevronRight className="h-4 w-4" />
              <Link
                href={`/occasions/${collection.occasion.slug}`}
                className="hover:text-brand"
              >
                {collection.occasion.title}
              </Link>
            </>
          ) : null}
          <ChevronRight className="h-4 w-4" />
          <span className="text-ink">{collection.title}</span>
        </nav>

        <header className="mb-8 max-w-3xl">
          <h1 className="text-3xl font-bold text-ink lg:text-4xl">
            {collection.title}
          </h1>
          {collection.description ? (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">
              {collection.description}
            </p>
          ) : null}
          <p className="mt-4 text-sm font-medium text-muted">
            Showing {end === 0 ? 0 : 1}-{end} of {totalProducts} results
          </p>
        </header>

        <ProductExplorer
          initialProducts={products}
          totalProducts={totalProducts}
          loadMoreEndpoint={`/api/collections/${collection.slug}/products`}
          collectionSlug={collection.slug}
        />
      </section>
    </PageWrapper>
  );
}
