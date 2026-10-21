import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readProfile } from "@/lib/auth/profile";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

/** A client whose users select answers by the columns asked for. */
function clientFor(results: Record<string, { data: unknown; error: unknown }>) {
  const select = vi.fn((columns: string) => {
    const query = { eq: () => query, maybeSingle: async () => results[columns] };
    return query;
  });
  return { client: { from: () => ({ select }) } as unknown as SupabaseClient, select };
}

describe("readProfile", () => {
  it("reads name, avatar and account type in one query", async () => {
    const { client, select } = clientFor({
      "full_name, avatar_url, account_type": {
        data: { full_name: "Ada Obi", avatar_url: "https://img.test/a.png", account_type: "business" },
        error: null,
      },
    });
    expect(await readProfile(client, "user-1")).toEqual({
      full_name: "Ada Obi",
      avatar_url: "https://img.test/a.png",
      account_type: "business",
    });
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("keeps name and avatar when account_type is missing (migration 042 not applied)", async () => {
    const { client } = clientFor({
      "full_name, avatar_url, account_type": {
        data: null,
        error: { code: "42703", message: "column users.account_type does not exist" },
      },
      "full_name, avatar_url": { data: { full_name: "Ada Obi", avatar_url: "https://img.test/a.png" }, error: null },
    });
    expect(await readProfile(client, "user-1")).toEqual({
      full_name: "Ada Obi",
      avatar_url: "https://img.test/a.png",
      account_type: null,
    });
  });

  it("reports an unrecognised account type as unknown", async () => {
    const { client } = clientFor({
      "full_name, avatar_url, account_type": { data: { full_name: null, avatar_url: null, account_type: null }, error: null },
    });
    expect((await readProfile(client, "user-1")).account_type).toBeNull();
  });
});
