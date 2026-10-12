"use client";

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThemeSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeSelector({ className, showLabel = true }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();

  return (
    <label className={cn("inline-flex items-center gap-3 text-sm font-medium text-foreground", className)}>
      <span className={showLabel ? "" : "sr-only"}>Appearance</span>
      <select
        aria-label={showLabel ? undefined : "Appearance"}
        value={theme ?? "system"}
        onChange={(event) => setTheme(event.target.value)}
        className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
