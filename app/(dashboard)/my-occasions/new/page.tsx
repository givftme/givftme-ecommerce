import { CreateOccasionForm } from "@/components/occasion/CreateOccasionForm";
import { getAvailableMasterItems } from "@/lib/occasion/server";
import { requireDashboardUser } from "@/lib/wishlist/server";

export default async function NewOccasionPage() {
  const { supabase, user } = await requireDashboardUser("/my-occasions/new");
  const evergreenItems = await getAvailableMasterItems(supabase, user.id);

  return (
    <CreateOccasionForm
      evergreenItems={evergreenItems}
      initialStep={1}
    />
  );
}
