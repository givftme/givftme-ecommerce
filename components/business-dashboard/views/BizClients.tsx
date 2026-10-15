"use client";

import { BizPeopleTable } from "@/components/business-dashboard/views/BizPeopleTable";
import { RELATIONSHIPS } from "@/lib/business-dashboard/data";
import type { BusinessPerson } from "@/lib/business-dashboard/types";

const relationship = (person: BusinessPerson) => person.relationship || "Client";

/** Clients & partners: the Staff table with client columns. */
export function BizClients() {
  return (
    <BizPeopleTable
      kind="client"
      title="Clients & partners"
      description="The relationships you keep warm with a gift on their day."
      filterLabel="Relationship"
      filterValue={relationship}
      filterOptions={[...RELATIONSHIPS]}
    />
  );
}
