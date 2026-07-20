import Image from "next/image";
import Link from "next/link";
import { Gift } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { MuseumCollection } from "@/lib/sanity/types";

export function CollectionCard({
  collection,
}: {
  collection: MuseumCollection;
}) {
  return (
    <Link href={`/collections/${collection.slug}`} className="collection-card group block">
      <article>
        <div
          className="relative overflow-hidden rounded-2xl bg-surface"
          style={{ aspectRatio: "3 / 2" }}
        >
          {collection.coverImageUrl ? (
            <Image
              src={collection.coverImageUrl}
              alt={collection.title}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Gift className="h-10 w-10 text-stone-300" strokeWidth={1.5} />
            </div>
          )}
          {collection.featured ? (
            <Badge variant="sale" className="absolute left-3 top-3">
              Featured
            </Badge>
          ) : null}
        </div>
        <div className="mt-4 space-y-2">
          <h3 className="text-base font-semibold text-ink transition-colors group-hover:text-brand">
            {collection.title}
          </h3>
          {collection.description ? (
            <p className="line-clamp-2 text-sm leading-6 text-muted">
              {collection.description}
            </p>
          ) : null}
          <p className="text-sm font-medium text-muted">
            {collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}
          </p>
        </div>
      </article>
    </Link>
  );
}
