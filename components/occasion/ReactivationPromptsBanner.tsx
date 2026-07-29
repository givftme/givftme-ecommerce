import Link from "next/link";
import { Sparkles } from "lucide-react";
import { OCCASION_LABELS } from "@/lib/occasion/constants";
import type { OccasionPromptSummary } from "@/lib/occasion/types";

export function ReactivationPromptsBanner({
  prompts,
}: {
  prompts: OccasionPromptSummary[];
}) {
  if (prompts.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-brand/30 bg-brand-light p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand">
          <Sparkles className="h-5 w-5" strokeWidth={1.7} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-ink">
            {prompts.length === 1
              ? "A past occasion has gifts to review"
              : `${prompts.length} past occasions have gifts to review`}
          </p>
          <ul className="space-y-1.5">
            {prompts.map((prompt) => (
              <li key={prompt.id}>
                <Link
                  href={`/my-occasions/${prompt.occasion_id}`}
                  className="text-sm font-medium text-brand hover:text-brand-dark"
                >
                  {prompt.occasion_title || OCCASION_LABELS[prompt.occasion_type]} —{" "}
                  {prompt.item_count} {prompt.item_count === 1 ? "item" : "items"} purchased →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
