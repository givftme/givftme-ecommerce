import { CreateOccasionForm } from "@/components/occasion/CreateOccasionForm";
import { getAvailableMasterItems } from "@/lib/occasion/server";
import { requireDashboardUser } from "@/lib/wishlist/server";

function parseStep(value: string | string[] | undefined): 1 | 2 | 3 {
  const step = Array.isArray(value) ? value[0] : value;

  if (step === "2") {
    return 2;
  }

  if (step === "3") {
    return 3;
  }

  return 1;
}

export default async function NewOccasionPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const query = await searchParams;
  const { supabase, user } = await requireDashboardUser();
  const evergreenItems = await getAvailableMasterItems(supabase, user.id);

  return (
    <CreateOccasionForm
      evergreenItems={evergreenItems}
      initialStep={parseStep(query.step)}
    />
  );
}
