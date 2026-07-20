import Image from "next/image";
import Link from "next/link";
import { ArrowRight, PartyPopper } from "lucide-react";
import type { MuseumOccasion } from "@/lib/sanity/types";

export function MuseumOccasionCard({ occasion }: { occasion: MuseumOccasion }) {
  return (
    <Link
      href={`/occasions/${occasion.slug}`}
      className="museum-occasion-card group block overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition-colors hover:border-brand/40"
    >
      <div
        className="relative bg-surface"
        style={{ aspectRatio: "4 / 3" }}
      >
        {occasion.coverImageUrl ? (
          <Image
            src={occasion.coverImageUrl}
            alt={occasion.title}
            fill
            sizes="(max-width: 768px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PartyPopper className="h-10 w-10 text-stone-300" strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-sm">
          {occasion.emoji || "🎁"}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <h2 className="text-base font-semibold text-ink">{occasion.title}</h2>
        <p className="text-sm text-muted">
          {occasion.collectionCount}{" "}
          {occasion.collectionCount === 1 ? "collection" : "collections"}
        </p>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
          Shop now
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
