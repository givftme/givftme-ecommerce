"use client";

import { BizPeopleTable } from "@/components/business-dashboard/views/BizPeopleTable";
import { DEPARTMENTS } from "@/lib/business-dashboard/data";
import type { BusinessPerson } from "@/lib/business-dashboard/types";

const department = (person: BusinessPerson) => person.department || "Unassigned";

/** Staff table with a department filter and bulk actions. */
export function BizStaff() {
  return (
    <BizPeopleTable
      kind="staff"
      title="Staff"
      description="Everyone whose birthday and work anniversary you celebrate."
      filterLabel="Department"
      filterValue={department}
      filterOptions={DEPARTMENTS}
    />
  );
}
