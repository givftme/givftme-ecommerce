import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function DatesPage() {
  return (
    <main className="min-h-dvh bg-surface px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">Save Special Dates</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
              Keep important moments close so gifting never feels last-minute.
            </p>
          </div>
          <Link
            href="/wishlists"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "self-start sm:self-auto"
            )}
          >
            View wishlists
          </Link>
        </header>

        <section className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
          <div className="rounded-2xl bg-surface px-4 py-10 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white">
              <CalendarHeart className="h-8 w-8 text-brand" strokeWidth={1.7} />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-ink">
              No special dates saved yet
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
              Your saved birthdays, anniversaries, and reminders will appear here.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
