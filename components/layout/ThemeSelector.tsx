"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const appearances = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

type Appearance = (typeof appearances)[number]["value"];

const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface ThemeSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeSelector({ className, showLabel = true }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    getClientSnapshot,
    getServerSnapshot
  );
  const [isOpen, setIsOpen] = useState(false);
  const optionsId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Keep the server render and first client render identical. next-themes then
  // supplies the saved preference after hydration, including System mode.
  const selectedAppearance: Appearance = mounted && isAppearance(theme) ? theme : "system";
  const selectedOption = appearances.find(({ value }) => value === selectedAppearance)!;
  const TriggerIcon = selectedOption.Icon;

  return (
    <div ref={rootRef} className={cn("relative inline-flex items-center gap-3", className)}>
      {showLabel ? (
        <span className="text-sm font-medium text-foreground">Appearance</span>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Appearance: ${selectedOption.label}`}
        aria-expanded={isOpen}
        aria-controls={optionsId}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-card text-ink transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <TriggerIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      <div
        id={optionsId}
        role="group"
        aria-label="Appearance"
        hidden={!isOpen}
        className="absolute right-0 top-full z-60 mt-2 w-44 rounded-2xl border border-line bg-card p-1.5 text-card-foreground shadow-lg"
      >
        {appearances.map(({ value, label, Icon }) => {
          const isSelected = selectedAppearance === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => {
                setTheme(value);
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                isSelected ? "font-semibold text-brand" : "text-ink"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function isAppearance(value: string | undefined): value is Appearance {
  return appearances.some((appearance) => appearance.value === value);
}
