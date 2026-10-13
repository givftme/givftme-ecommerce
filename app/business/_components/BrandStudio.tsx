"use client";

import {
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type LucideIcon,
  CakeSlice,
  CreditCard,
  Download,
  Gift,
  ImageUp,
  Move3d,
  PackageOpen,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Icon, cx } from "@/components/ui/primitives";
import { useFeedback } from "@/hooks/useFeedback";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import { cn, formatPrice } from "@/lib/utils";
import { useBusiness } from "@/app/business/_components/BusinessContext";
import { BRAND_SWATCHES, STUDIO_MESSAGES } from "@/app/business/_components/content";
import {
  type Studio,
  type StudioDesign,
  type StudioProduct,
  createStudio,
} from "@/app/business/_components/studioScene";

const PRODUCTS: { value: StudioProduct; label: string; icon: LucideIcon }[] = [
  { value: "cake", label: "Cake pack", icon: CakeSlice },
  { value: "box", label: "Gift box", icon: Gift },
  { value: "card", label: "Gift card", icon: CreditCard },
];

const MAX_LOGO_BYTES = 4 * 1024 * 1024;
const CUSTOM_COLOR_DEFAULT = "#f59e0b";

const fieldClass = "flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted";
const controlClass = "h-[42px] rounded-xl border-[1.5px] px-3 max-sm:text-base";
const stageChip =
  "absolute inline-flex items-center gap-1.5 rounded-full bg-card/85 px-2.5 py-1.5 text-xs text-foreground";

/**
 * The hero's live mockup: the visitor's name, message, colour and logo painted
 * onto a 3D cake pack, gift box or gift card they can turn and open. The
 * controls keep working without WebGL, feeding the gift card preview below.
 */
export function BrandStudio() {
  const { brandName, displayName, setBrandName, brandColor, setBrandColor, giftCardValue } =
    useBusiness();
  const { toast } = useFeedback();
  const reduce = useReducedMotion();

  const stageRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLSpanElement>(null);
  const studioRef = useRef<Studio | null>(null);

  const [product, setProduct] = useState<StudioProduct>("cake");
  const [message, setMessage] = useState(STUDIO_MESSAGES[0]);
  const [logo, setLogo] = useState<{ image: HTMLImageElement; name: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [fallback, setFallback] = useState(false);

  const design = useMemo<StudioDesign>(
    () => ({
      name: displayName,
      message,
      color: brandColor,
      logo: logo?.image ?? null,
      cardAmount: formatPrice(giftCardValue),
    }),
    [displayName, message, brandColor, logo, giftCardValue],
  );

  // The scene is built once per motion preference; these hand it the latest state.
  const designRef = useRef(design);
  const productRef = useRef(product);
  useEffect(() => {
    designRef.current = design;
    productRef.current = product;
  });

  useEffect(() => {
    const stage = stageRef.current;
    const holder = holderRef.current;
    if (!stage || !holder) return;

    let studio: Studio | null = null;
    let cancelled = false;

    import("three")
      .then((THREE) => {
        if (cancelled) return;
        studio = createStudio(THREE, {
          stage,
          holder,
          reduce,
          design: designRef.current,
          product: productRef.current,
        });
        if (!studio) {
          setFallback(true);
          return;
        }
        studioRef.current = studio;
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });

    return () => {
      cancelled = true;
      studioRef.current = null;
      studio?.dispose();
    };
  }, [reduce]);

  // Repainting five canvases per keystroke is wasteful, so let typing settle first.
  useEffect(() => {
    const id = setTimeout(() => studioRef.current?.paint(design), 90);
    return () => clearTimeout(id);
  }, [design]);

  const chooseProduct = (next: StudioProduct) => {
    setProduct(next);
    setOpen(false);
    studioRef.current?.setProduct(next);
  };

  const toggleOpen = () => {
    setOpen(!open);
    studioRef.current?.setOpen(!open);
  };

  const saveMockup = () => {
    const studio = studioRef.current;
    if (!studio) return;
    try {
      const link = document.createElement("a");
      link.href = studio.snapshot();
      link.download = `${displayName.replace(/\W+/g, "-").toLowerCase()}-${product}-mockup.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast("Mockup saved");
    } catch {
      toast("Couldn’t save the image on this browser");
    }
  };

  const uploadLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      toast("Logo is too large. Use one under 4 MB.");
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      setLogo({ image, name: file.name });
      toast("Logo added");
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      toast("We couldn’t read that image.");
    };
    image.src = url;
  };

  const isSwatch = BRAND_SWATCHES.some((swatch) => swatch.value === brandColor);

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-card-xl bg-soft p-3.5 max-sm:rounded-[28px] max-sm:p-2.5">
      <div
        ref={stageRef}
        className="relative h-[400px] overflow-hidden rounded-[26px] bg-[radial-gradient(120%_90%_at_50%_20%,var(--color-card)_0%,var(--color-peach)_60%,var(--color-peach-deep)_100%)] max-sm:h-[320px]"
      >
        {fallback ? (
          <p className="absolute inset-0 flex items-center justify-center p-8 text-center text-muted">
            3D preview isn’t available on this device. The Experience Centre will send you mockups
            instead.
          </p>
        ) : (
          <>
            <span
              ref={holderRef}
              role="img"
              aria-label={`3D preview of your branded ${PRODUCTS.find((p) => p.value === product)?.label.toLowerCase()}`}
              className="block size-full"
            />
            <span className={cx(stageChip, "pointer-events-none bottom-3 left-3.5")}>
              <Icon as={Move3d} size={16} />
              Drag to turn
            </span>
            <div className="absolute right-3.5 bottom-3 flex gap-2">
              {product !== "card" && (
                <StageButton onClick={toggleOpen} aria-pressed={open}>
                  <Icon as={PackageOpen} size={16} />
                  {open ? "Close" : "Open"}
                </StageButton>
              )}
              <StageButton onClick={saveMockup}>
                <Icon as={Download} size={16} />
                Save
              </StageButton>
            </div>
          </>
        )}
        <span
          className={cx(
            stageChip,
            "pointer-events-none top-3 right-3.5 bg-card font-medium shadow-soft",
          )}
        >
          <span className="size-2 rounded-full bg-success" />
          Live preview
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-[22px] bg-card p-3.5 max-sm:grid-cols-1 max-sm:p-3">
        <div
          role="group"
          aria-label="Product"
          className="col-span-full grid grid-cols-3 gap-1 rounded-[14px] bg-soft p-1"
        >
          {PRODUCTS.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={product === value}
              onClick={() => chooseProduct(value)}
              className={cx(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-[11px] text-[13px] font-medium transition-colors max-sm:text-xs",
                product === value
                  ? "bg-card text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                  : "text-muted hover:text-foreground",
              )}
            >
              <Icon as={icon} size={16} />
              {label}
            </button>
          ))}
        </div>

        <label className={fieldClass}>
          Company name
          <Input
            type="text"
            maxLength={28}
            autoComplete="organization"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            className={controlClass}
          />
        </label>

        <label className={fieldClass}>
          Message
          <select
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={cn(
              "w-full border-line bg-card pr-9 text-sm text-ink outline-none select-caret focus:border-brand focus:ring-2 focus:ring-brand/20",
              controlClass,
            )}
          >
            {STUDIO_MESSAGES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>

        <div className={fieldClass}>
          <span>Brand colour</span>
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_SWATCHES.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={brandColor === value}
                onClick={() => setBrandColor(value)}
                style={{ background: value }}
                className={cx(
                  "size-[30px] rounded-full border-2 border-card p-0",
                  brandColor === value ? "ring-2 ring-foreground" : "ring-1 ring-line",
                )}
              />
            ))}
            <label
              title="Pick your exact brand colour"
              className={cx(
                "relative size-[30px] cursor-pointer overflow-hidden rounded-full bg-[conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)]",
                isSwatch ? "ring-1 ring-line" : "ring-2 ring-foreground",
              )}
            >
              <input
                type="color"
                aria-label="Custom brand colour"
                value={isSwatch ? CUSTOM_COLOR_DEFAULT : brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="absolute -inset-2 size-[46px] cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>

        <label className={fieldClass}>
          <span>Your logo</span>
          <span className="flex h-[42px] cursor-pointer items-center gap-2 overflow-hidden rounded-xl border-[1.5px] border-dashed border-line px-3 text-[13px] whitespace-nowrap text-foreground focus-within:border-brand">
            <Icon as={ImageUp} size={16} className="text-brand" />
            <span className="truncate">{logo?.name ?? "Upload PNG or JPG"}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={uploadLogo}
              className="sr-only"
            />
          </span>
        </label>
      </div>
    </div>
  );
}

function StageButton(props: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12.5px] font-medium text-foreground"
    />
  );
}
