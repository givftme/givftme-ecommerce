"use client";

import { useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import type {
  ProductVariant,
  VariantAttribute,
  VariantAttributeOption,
} from "@/lib/sanity/types";

interface VariantSelectorProps {
  productId: string;
  attributes: VariantAttribute[];
  variants: ProductVariant[];
  selectedOptions: Record<string, string>;
  onChange: (options: Record<string, string>) => void;
}

function variantMatches(
  variant: ProductVariant,
  selectedOptions: Record<string, string>
) {
  return Object.entries(selectedOptions).every(([attribute, value]) =>
    variant.options.some(
      (option) => option.attribute === attribute && option.value === value
    )
  );
}

function isOptionAvailable(
  option: VariantAttributeOption,
  attributeName: string,
  selectedOptions: Record<string, string>,
  variants: ProductVariant[]
) {
  const nextOptions = { ...selectedOptions, [attributeName]: option.value };

  return variants.some(
    (variant) => variant.available && variantMatches(variant, nextOptions)
  );
}

export function VariantSelector({
  productId,
  attributes,
  variants,
  selectedOptions,
  onChange,
}: VariantSelectorProps) {
  const selectedPillRef = useRef<HTMLButtonElement | null>(null);

  if (attributes.length === 0) {
    return null;
  }

  const selectOption = (
    attribute: VariantAttribute,
    option: VariantAttributeOption,
    target: HTMLButtonElement
  ) => {
    selectedPillRef.current = target;
    onChange({ ...selectedOptions, [attribute.name]: option.value });
    gsap.to(target, {
      scale: 0.95,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: "power1.out",
    });
    trackEvent("museum.product.variant_selected", {
      product_id: productId,
      attribute: attribute.name,
      value: option.value,
    });
  };

  return (
    <div className="space-y-5">
      {attributes.map((attribute) => (
        <div key={attribute._key || attribute.name} className="space-y-3">
          <p className="text-sm font-semibold text-ink">{attribute.label}</p>
          <div className="flex flex-wrap gap-2">
            {attribute.options.map((option) => {
              const selected = selectedOptions[attribute.name] === option.value;
              const available = isOptionAvailable(
                option,
                attribute.name,
                selectedOptions,
                variants
              );

              return (
                <button
                  key={option._key || option.value}
                  type="button"
                  disabled={!available}
                  onClick={(event) =>
                    selectOption(attribute, option, event.currentTarget)
                  }
                  className={cn(
                    "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                    selected
                      ? "border-brand bg-brand-light text-brand"
                      : "border-stone-200 bg-white text-ink hover:border-brand/40",
                    !available &&
                      "cursor-not-allowed border-stone-100 bg-surface text-muted line-through"
                  )}
                >
                  {option.colorHex ? (
                    <span
                      aria-hidden="true"
                      className="h-4 w-4 rounded-full border border-stone-200"
                      style={{ backgroundColor: option.colorHex }}
                    />
                  ) : null}
                  {option.label}
                  {!available ? <span className="text-xs">Sold out</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
