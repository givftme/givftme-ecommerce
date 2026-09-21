"use client"

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a media query and re-renders when it flips. Reports `false`
 * during server rendering and hydration, so pointer and motion effects only
 * switch on once the browser can answer the query.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useReducedMotion = () =>
  useMediaQuery("(prefers-reduced-motion: reduce)");

/** True on mouse-driven devices — gates the magnetic buttons and card tilt. */
export const useFinePointer = () => useMediaQuery("(pointer: fine)");
