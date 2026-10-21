import { describe, expect, it } from "vitest";
import { resendFailure } from "@/lib/auth/resend";

describe("resendFailure", () => {
  it.each([{ status: 429 }, { code: "over_email_send_rate_limit" }, { status: 400, code: "over_request_rate_limit" }])(
    "asks a rate-limited visitor to wait (%o)",
    (error) => {
      expect(resendFailure(error)).toEqual({ message: expect.stringContaining("Wait a minute"), cooldown: true });
    },
  );

  it("points other failures, like an already confirmed email, at sign-in", () => {
    const failure = resendFailure({ status: 422, code: "validation_failed" });
    expect(failure.cooldown).toBe(false);
    expect(failure.message).toContain("sign in instead");
    expect(resendFailure(null).cooldown).toBe(false);
  });
});
