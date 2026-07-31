import { ImportantDatesClient } from "@/components/reminders/ImportantDatesClient";
import { getImportantDates } from "@/lib/important-dates/server";
import { requireDashboardUser } from "@/lib/wishlist/server";

export default async function DatesPage() {
  const { supabase, user } = await requireDashboardUser();
  const dates = await getImportantDates(supabase, user.id);

  return (
    <main className="min-h-dvh bg-surface px-4 py-6">
      <div className="mx-auto max-w-4xl">
        <ImportantDatesClient initialDates={dates} />
      </div>
    </main>
  );
}
