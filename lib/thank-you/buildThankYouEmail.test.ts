import { describe, expect, it } from "vitest";
import { buildAutoThankYouEmail, buildPersonalThankYouEmail } from "./buildThankYouEmail";

describe("buildAutoThankYouEmail", () => {
  it("builds the expected subject and includes the message and item title", () => {
    const email = buildAutoThankYouEmail({
      message: "Thanks a bunch!",
      receiverName: "Ada",
      itemTitle: "A cool mug",
    });

    expect(email.subject).toBe("🎁 Ada says thank you!");
    expect(email.text).toContain("Thanks a bunch!");
    expect(email.text).toContain("A cool mug");
    expect(email.html).toContain("Thanks a bunch!");
  });

  it("escapes HTML in the message", () => {
    const email = buildAutoThankYouEmail({
      message: "<script>alert(1)</script>",
      receiverName: "Ada",
      itemTitle: "A cool mug",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("buildPersonalThankYouEmail", () => {
  it("builds the expected subject and includes the message", () => {
    const email = buildPersonalThankYouEmail({
      message: "You're the best!",
      receiverName: "Ada",
      itemTitle: "A cool mug",
    });

    expect(email.subject).toBe("💌 A personal message from Ada");
    expect(email.text).toContain("You're the best!");
    expect(email.text).toContain("A cool mug");
  });
});
