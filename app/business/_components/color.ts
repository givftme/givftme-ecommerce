/**
 * Helpers for the visitor's brand colour, which can be any hex they pick, so
 * text on it has to choose light or dark ink at runtime.
 */

/** Darkens (negative amount) or lightens (positive amount) a #rrggbb colour. */
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (x: number) =>
    Math.round(
      Math.max(0, Math.min(255, amount < 0 ? x * (1 + amount) : x + (255 - x) * amount)),
    );
  const r = channel(n >> 16);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const isLight = (hex: string) => luminance(hex) > 0.45;

/** Readable ink for text drawn on top of `hex`. */
export const inkFor = (hex: string) => (isLight(hex) ? "#16161a" : "#ffffff");
