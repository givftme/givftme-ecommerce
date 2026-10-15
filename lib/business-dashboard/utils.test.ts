import { describe, expect, it } from "vitest";
import type { BusinessCampaign, BusinessPerson } from "@/lib/business-dashboard/types";
import {
  audienceHeads,
  campaignCost,
  colorPalette,
  daysTo,
  formatNaira,
  formatNairaK,
  guessColumnMap,
  initials,
  lagosToday,
  milestoneYears,
  nextMilestone,
  nextOccurrence,
  parseCSV,
  parseDate,
  scheduleCsv,
  suggestedDeliveryDate,
  toIsoDate,
  upcomingMoments,
  validateImportRows,
} from "@/lib/business-dashboard/utils";

const TODAY = new Date(2026, 9, 15); // 15 Oct 2026

function person(overrides: Partial<BusinessPerson>): BusinessPerson {
  return {
    id: "p1",
    kind: "staff",
    name: "Ngozi Adeyemi",
    department: "Finance",
    role_title: "Accountant",
    bday: "10-20",
    start_date: null,
    company: null,
    relationship: null,
    account_owner: null,
    tier: "Standard",
    ...overrides,
  };
}

function campaign(overrides: Partial<BusinessCampaign>): BusinessCampaign {
  return {
    id: "c1",
    name: "CSW 2026",
    occasion: "Customer Service Week",
    audience: "Everyone",
    heads: 40,
    per_head: 18000,
    delivery_fee: 2500,
    delivery_date: "2026-10-20",
    gift_type: "Treat pack",
    card_message: null,
    status: "Approved",
    owner: null,
    created_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

describe("dates", () => {
  it("finds the next occurrence, counting today", () => {
    expect(toIsoDate(nextOccurrence("10-15", TODAY))).toBe("2026-10-15");
    expect(toIsoDate(nextOccurrence("10-20", TODAY))).toBe("2026-10-20");
    expect(toIsoDate(nextOccurrence("03-14", TODAY))).toBe("2027-03-14");
  });

  it("puts 29 Feb birthdays on 28 Feb outside leap years", () => {
    expect(toIsoDate(nextOccurrence("02-29", TODAY))).toBe("2027-02-28");
    expect(toIsoDate(nextOccurrence("02-29", new Date(2027, 5, 1)))).toBe("2028-02-29");
  });

  it("counts calendar days", () => {
    expect(daysTo(new Date(2026, 9, 20, 23, 0), new Date(2026, 9, 15, 8, 0))).toBe(5);
    expect(daysTo(new Date(2026, 9, 14), TODAY)).toBe(-1);
  });

  it("reads today's Lagos date", () => {
    expect(toIsoDate(lagosToday(new Date("2026-10-15T23:30:00Z")))).toBe("2026-10-16");
  });

  it.each([
    ["14/03/1990", { mm: 3, dd: 14, yy: 1990 }],
    ["14-03-90", { mm: 3, dd: 14, yy: 1990 }],
    ["14/03", { mm: 3, dd: 14, yy: null }],
    ["1990-03-14", { mm: 3, dd: 14, yy: 1990 }],
    ["14 Mar 1990", { mm: 3, dd: 14, yy: 1990 }],
    ["14 March", { mm: 3, dd: 14, yy: null }],
    ["14th March 1990", { mm: 3, dd: 14, yy: 1990 }],
    ["Mar 14 1990", { mm: 3, dd: 14, yy: 1990 }],
    ["March 14, 1990", { mm: 3, dd: 14, yy: 1990 }],
    ["29/02", { mm: 2, dd: 29, yy: null }],
  ])("parses %s day first", (value, expected) => {
    expect(parseDate(value)).toEqual(expected);
  });

  it.each(["", "31/02/1990", "13/13", "29/02/2023", "someday", "Smarch 4"])("rejects %s", (value) => {
    expect(parseDate(value)).toBeNull();
  });

  it("counts years of service", () => {
    expect(milestoneYears(new Date(2021, 9, 20), new Date(2026, 9, 19))).toBe(4);
    expect(milestoneYears(new Date(2021, 9, 20), new Date(2026, 9, 20))).toBe(5);
  });

  it("finds the next milestone anniversary", () => {
    const next = nextMilestone(new Date(2023, 2, 14), TODAY);
    expect(next?.years).toBe(5);
    expect(toIsoDate(next!.date)).toBe("2028-03-14");
    expect(nextMilestone(new Date(1990, 0, 1), TODAY)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats naira", () => {
    expect(formatNaira(12345)).toBe("₦12,345");
    expect(formatNairaK(12345)).toBe("₦12k");
    expect(formatNairaK(1500)).toBe("₦1.5k");
    expect(formatNairaK(1_200_000)).toBe("₦1.2m");
    expect(formatNairaK(500)).toBe("₦500");
  });

  it("makes initials and stable avatar colours", () => {
    expect(initials("Ngozi Adeyemi")).toBe("NA");
    expect(initials("  emeka  ")).toBe("E");
    expect(initials("")).toBe("?");
    expect(colorPalette("Ngozi Adeyemi")).toEqual(colorPalette("ngozi adeyemi"));
  });

  it("costs a campaign per head plus delivery", () => {
    expect(campaignCost(campaign({}))).toBe(40 * 20500);
    expect(campaignCost(campaign({}), 0)).toBe(40 * 18000);
  });
});

describe("parseCSV", () => {
  it("handles quotes, escaped quotes and line breaks in quotes", () => {
    const text = '﻿Name,Notes\r\n"Adeyemi, Ngozi","Said ""hi""\nthen left"\r\n\r\nEmeka,ok\n';
    expect(parseCSV(text)).toEqual([
      ["Name", "Notes"],
      ["Adeyemi, Ngozi", 'Said "hi"\nthen left'],
      ["Emeka", "ok"],
    ]);
  });

  it("detects tab-delimited Excel pastes", () => {
    expect(parseCSV("Name\tBirthday\nNgozi, A\t14/03")).toEqual([
      ["Name", "Birthday"],
      ["Ngozi, A", "14/03"],
    ]);
  });
});

describe("import", () => {
  it("guesses column mappings from headers", () => {
    expect(guessColumnMap(["Full Name", "DOB", "Dept", "Job Title", "Date Joined"], "staff")).toEqual({
      name: 0,
      bday: 1,
      department: 2,
      role_title: 3,
      start_date: 4,
    });
    expect(guessColumnMap(["Client name", "Birthday", "Company", "Account owner"], "client")).toMatchObject({
      name: 0,
      bday: 1,
      company: 2,
      relationship: -1,
      account_owner: 3,
    });
  });

  it("splits rows into good, bad and duplicates", () => {
    const rows = [
      ["Ngozi Adeyemi", "14/03/1990", "", "Accountant", "02/05/2019"],
      ["", "01/01", "", "", ""],
      ["Emeka Okafor", "not a date", "Sales", "", ""],
      ["ngozi adeyemi", "14/03", "", "", ""],
      ["Tunde Bello", "28 Aug", "Sales", "", "2022"],
      ["Existing Person", "01/02", "", "", ""],
      ["J", "01/02", "", "", ""],
    ];
    const map = { name: 0, bday: 1, department: 2, role_title: 3, start_date: 4 };
    const result = validateImportRows(rows, [], map, "staff", ["EXISTING PERSON"]);

    expect(result.ok).toEqual([
      expect.objectContaining({ name: "Ngozi Adeyemi", bday: "03-14", department: "Unassigned", start_date: "2019-05-02" }),
      expect.objectContaining({ name: "Tunde Bello", bday: "08-28", department: "Sales", start_date: null }),
    ]);
    expect(result.bad.map((problem) => problem.row)).toEqual([3, 4, 8]);
    expect(result.dupes.map((problem) => problem.name)).toEqual(["ngozi adeyemi", "Existing Person"]);
  });
});

describe("upcomingMoments", () => {
  it("merges birthdays, milestone anniversaries and campaigns, soonest first", () => {
    const people = [
      person({ id: "a", name: "Ngozi Adeyemi", bday: "10-20", start_date: "2021-10-25" }),
      person({ id: "b", name: "Funke Bello", kind: "client", bday: "10-15", company: "Lagos Ltd", relationship: "Client", department: null }),
      person({ id: "c", name: "Emeka Okafor", bday: "12-01", start_date: "2025-01-01" }),
    ];
    const campaigns = [
      campaign({ id: "x", delivery_date: "2026-10-18" }),
      campaign({ id: "draft", status: "Draft", delivery_date: "2026-10-16" }),
      campaign({ id: "past", delivery_date: "2026-10-01" }),
    ];

    const moments = upcomingMoments(people, campaigns, 60, TODAY);
    expect(moments.map((moment) => [moment.id, moment.days, moment.label])).toEqual([
      ["birthday-b", 0, "Birthday"],
      ["campaign-x", 3, "Campaign"],
      ["birthday-a", 5, "Birthday"],
      ["anniversary-a", 10, "5 years"],
      ["birthday-c", 47, "Birthday"],
    ]);
    expect(moments[0].sub).toBe("Lagos Ltd · Client");
    expect(moments[1].sub).toBe("Everyone · 40 people");
  });

  it("exports the schedule with the spec's columns", () => {
    const csv = scheduleCsv(upcomingMoments([person({ name: "Adeyemi, Ngozi" })], [], 365, TODAY));
    expect(csv).toBe('Date,Type,Name,Details,Days away\r\n2026-10-20,Birthday,"Adeyemi, Ngozi",Finance · Accountant,5');
  });
});

describe("suggestedDeliveryDate", () => {
  it("uses the occasion's fixed date when it is still ahead", () => {
    expect(toIsoDate(suggestedDeliveryDate("Customer Service Week", new Date(2026, 8, 1)))).toBe("2026-10-05");
    expect(toIsoDate(suggestedDeliveryDate("Customer Service Week", TODAY))).toBe("2027-10-04");
    expect(toIsoDate(suggestedDeliveryDate("Father's Day", TODAY))).toBe("2027-06-20");
    expect(toIsoDate(suggestedDeliveryDate("Independence Day", TODAY))).toBe("2027-10-01");
    expect(toIsoDate(suggestedDeliveryDate("End of year", TODAY))).toBe("2026-12-15");
    expect(toIsoDate(suggestedDeliveryDate("Birthdays", TODAY))).toBe("2026-11-14");
  });
});

describe("audienceHeads", () => {
  const people = [
    person({ id: "1", department: "Finance" }),
    person({ id: "2", department: "Executive" }),
    person({ id: "3", department: null }),
    person({ id: "4", kind: "client", department: null }),
  ];

  it("counts heads from the people on file", () => {
    expect(audienceHeads("Everyone", people)).toBe(3);
    expect(audienceHeads("One department", people, "Finance")).toBe(1);
    expect(audienceHeads("One department", people, "Unassigned")).toBe(1);
    expect(audienceHeads("Executives", people)).toBe(1);
    expect(audienceHeads("Clients and partners", people)).toBe(1);
    expect(audienceHeads("Staff who are mothers", people)).toBe(2);
  });
});
