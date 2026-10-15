import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/events/server", () => ({ recordEvent: vi.fn() }));

const { updateAdminOrderStatus } = await import("@/lib/admin/data/orders");
const { updatePayout } = await import("@/lib/admin/data/pools");
const { getSegmentExport } = await import("@/lib/admin/data/growth");

type Result = { data?: unknown; error?: unknown; count?: number | null };

/**
 * A chainable stand-in for the Supabase client. Each call to `from(table)`
 * or `rpc(fn)` takes the next queued result for that key and records the
 * operations made on it.
 */
function fakeSupabase(queue: Record<string, Result[]>) {
  const calls: { key: string; ops: [string, unknown[]][] }[] = [];
  const builder = (key: string) => {
    const ops: [string, unknown[]][] = [];
    calls.push({ key, ops });
    const result = queue[key]?.shift() ?? { data: null, error: null };
    const chain: Record<string, unknown> = {};
    for (const name of ["select", "insert", "update", "delete", "eq", "in", "is", "not", "neq", "gte", "lt", "lte", "gt", "order", "limit", "range", "or", "ilike"]) {
      chain[name] = (...args: unknown[]) => {
        ops.push([name, args]);
        return chain;
      };
    }
    chain.maybeSingle = () => Promise.resolve(result);
    chain.single = () => Promise.resolve(result);
    chain.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ error: null, ...result }).then(resolve, reject);
    return chain;
  };
  const client = {
    from: (table: string) => builder(table),
    rpc: (fn: string) => builder(`rpc:${fn}`),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("updateAdminOrderStatus", () => {
  it("moves an order and audits the change", async () => {
    const { client, calls } = fakeSupabase({
      orders: [{ data: { id: "o1", status: "forwarded" } }, { data: [{ id: "o1" }] }],
      admin_actions: [{ data: null }],
    });
    const result = await updateAdminOrderStatus(client, "admin-1", "o1", {
      status: "shipped", tracking_number: "GIG1", carrier_name: "GIG", tracking_url: null, notes: "Left Lagos hub",
    });
    expect(result).toEqual({ ok: true, status: "shipped" });

    const update = calls.filter((call) => call.key === "orders")[1]!;
    expect(update.ops[0]).toEqual(["update", [{ status: "shipped", status_change_notes: "Left Lagos hub", tracking_number: "GIG1", carrier_name: "GIG" }]]);
    // Guarded on the status the admin saw.
    expect(update.ops).toContainEqual(["eq", ["status", "forwarded"]]);
    const audit = calls.find((call) => call.key === "admin_actions")!;
    expect(audit.ops[0]![1][0]).toMatchObject({ admin_id: "admin-1", action: "update_order_status", target_id: "o1", metadata: { from: "forwarded", to: "shipped" } });
  });

  it("rejects transitions outside the machine without writing", async () => {
    const { client, calls } = fakeSupabase({ orders: [{ data: { id: "o1", status: "confirmed" } }] });
    const result = await updateAdminOrderStatus(client, "admin-1", "o1", { status: "delivered", tracking_number: null, carrier_name: null, tracking_url: null, notes: null });
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(calls.filter((call) => call.key === "orders")).toHaveLength(1);
  });

  it("reports a conflict when the order changed in between", async () => {
    const { client, calls } = fakeSupabase({ orders: [{ data: { id: "o1", status: "shipped" } }, { data: [] }] });
    const result = await updateAdminOrderStatus(client, "admin-1", "o1", { status: "delivered", tracking_number: null, carrier_name: null, tracking_url: null, notes: null });
    expect(result).toMatchObject({ ok: false, status: 409 });
    expect(calls.some((call) => call.key === "admin_actions")).toBe(false);
  });
});

describe("updatePayout", () => {
  const complete = { status: "completed" as const, bank_name: "GTBank", account_number: "0123456789", account_name: "Ada Obi", reference: "TRF-1" };

  it("records the transfer and keeps only the last four digits in the audit log", async () => {
    const { client, calls } = fakeSupabase({
      pool_payouts: [{ data: { id: "p1", status: "processing", pool_id: "pool-1", amount: 50000 } }, { data: [{ id: "p1" }] }],
    });
    expect(await updatePayout(client, { id: "admin-1", email: "ops@givftme.test" }, "p1", complete)).toEqual({ ok: true });
    const update = calls.filter((call) => call.key === "pool_payouts")[1]!;
    expect(update.ops[0]![1][0]).toMatchObject({ status: "completed", account_number: "0123456789", reference: "TRF-1", processed_by: "ops@givftme.test" });
    const audit = calls.find((call) => call.key === "admin_actions")!.ops[0]![1][0] as { metadata: Record<string, unknown> };
    expect(audit.metadata).toMatchObject({ account_last4: "6789", to: "completed" });
    expect(JSON.stringify(audit.metadata)).not.toContain("0123456789");
  });

  it("won't re-process a completed payout or skip back to processing", async () => {
    const done = fakeSupabase({ pool_payouts: [{ data: { id: "p1", status: "completed", pool_id: "x", amount: 1 } }] });
    expect(await updatePayout(done.client, { id: "a", email: "" }, "p1", complete)).toMatchObject({ ok: false, status: 409 });
    const processing = fakeSupabase({ pool_payouts: [{ data: { id: "p1", status: "processing", pool_id: "x", amount: 1 } }] });
    expect(await updatePayout(processing.client, { id: "a", email: "" }, "p1", { status: "processing" })).toMatchObject({ ok: false, status: 409 });
  });
});

describe("getSegmentExport", () => {
  const member = (index: number) => ({ user_id: `u${index}`, name: `P${index}`, email: null, phone: null, city: null, next_date: null });

  it("withholds every row when the segment has fewer than 50 people", async () => {
    const { client } = fakeSupabase({ "rpc:gifvtme_admin_segment_members": [{ data: Array.from({ length: 49 }, (_, i) => member(i)) }] });
    expect(await getSegmentExport(client, "repeat_givers")).toEqual({ total: 49, rows: [], suppressed: true });
  });

  it("pages past the 1,000-row cap", async () => {
    const { client, calls } = fakeSupabase({
      "rpc:gifvtme_admin_segment_members": [
        { data: Array.from({ length: 1000 }, (_, i) => member(i)) },
        { data: Array.from({ length: 5 }, (_, i) => member(1000 + i)) },
      ],
    });
    const result = await getSegmentExport(client, "dormant");
    expect(result.total).toBe(1005);
    expect(result.rows).toHaveLength(1005);
    expect(calls.map((call) => call.ops.find(([name]) => name === "range")?.[1])).toEqual([[0, 999], [1000, 1999]]);
  });
});
