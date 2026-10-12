import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "next-themes";
import { describe, expect, it } from "vitest";
import { ThemeSelector } from "./ThemeSelector";

describe("ThemeSelector", () => {
  it("offers an accessible appearance control with system, light, and dark choices", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ThemeProvider,
        { attribute: "class", defaultTheme: "system", enableSystem: true },
        createElement(ThemeSelector, { showLabel: false }),
      ),
    );

    expect(markup).toContain('aria-label="Appearance: System"');
    expect(markup).toContain('role="group" aria-label="Appearance"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain(">Light</span>");
    expect(markup).toContain(">Dark</span>");
    expect(markup).toContain(">System</span>");
  });
});
