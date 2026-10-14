import { describe, expect, it } from "vitest";
import { businessEnquirySchema, teamSizeFor } from "@/lib/business/validation";

const valid = {
  company: "Acme Ltd",
  name: "Ada Obi",
  email: "ada@acme.ng",
  phone: "",
  occasions: ["Team birthdays"],
  teamSize: "21–100",
  neededBy: "",
  notes: "",
};

describe("businessEnquirySchema", () => {
  it("accepts a brief with an email only", () => {
    expect(businessEnquirySchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a brief with a phone number only", () => {
    const result = businessEnquirySchema.safeParse({ ...valid, email: "", phone: "+2348012345678" });
    expect(result.success).toBe(true);
  });

  it("requires the company and the sender's name", () => {
    const result = businessEnquirySchema.safeParse({ ...valid, company: "  ", name: "" });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["company", "name"]));
  });

  it("requires a way to reach the sender", () => {
    const result = businessEnquirySchema.safeParse({ ...valid, email: "", phone: " " });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["email"],
      message: "Add an email or phone number so we can reach you.",
    });
  });

  it("rejects a malformed email", () => {
    const result = businessEnquirySchema.safeParse({ ...valid, email: "ada@acme" });
    expect(result.success).toBe(false);
  });

  it("rejects an occasion outside the list", () => {
    const result = businessEnquirySchema.safeParse({ ...valid, occasions: ["Weddings"] });
    expect(result.success).toBe(false);
  });
});

describe("teamSizeFor", () => {
  it.each([
    [5, "1–20"],
    [20, "1–20"],
    [21, "21–100"],
    [100, "21–100"],
    [500, "101–500"],
    [501, "500+"],
  ])("puts %i people in %s", (count, bucket) => {
    expect(teamSizeFor(count)).toBe(bucket);
  });
});
