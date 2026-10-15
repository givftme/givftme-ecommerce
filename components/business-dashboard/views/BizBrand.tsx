"use client";

import { useRef, useState, type CSSProperties } from "react";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useBizDash } from "@/components/business-dashboard/BizDashContext";
import { Card, Field, ViewHeader } from "@/components/business-dashboard/BizUi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { saveBrand } from "@/lib/business-dashboard/actions";
import { BRAND_HOUSE_RULES } from "@/lib/business-dashboard/data";
import { initials } from "@/lib/business-dashboard/utils";
import { brandSchema, MAX_LOGO_BYTES } from "@/lib/business-dashboard/validation";

const HEX = /^#[0-9a-fA-F]{6}$/;

function PreviewLogo({ logo, company, tone }: { logo: string | null; company: string; tone: "light" | "dark" }) {
  return logo ? (
    // eslint-disable-next-line @next/next/no-img-element -- data URL preview
    <img src={logo} alt="" className="h-9 max-w-[96px] rounded-md bg-white/90 object-contain p-1" />
  ) : (
    <span
      className={
        tone === "light"
          ? "grid h-9 w-9 place-items-center rounded-full bg-white/20 text-xs font-bold text-white"
          : "grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs font-bold text-white"
      }
    >
      {initials(company || "Co")}
    </span>
  );
}

/** Company name, brand colour, logo and default message, with a live preview. */
export function BizBrand() {
  const { account, can, run, toast } = useBizDash();
  const editable = can("edit_brand");
  const fileInput = useRef<HTMLInputElement>(null);

  const [company, setCompany] = useState(account.company_name);
  const [color, setColor] = useState(account.brand_color.toUpperCase());
  const [hexDraft, setHexDraft] = useState(account.brand_color.toUpperCase());
  const [logo, setLogo] = useState<string | null>(account.logo_url);
  const [message, setMessage] = useState(account.default_message);
  const [saving, setSaving] = useState(false);

  const setBoth = (value: string) => {
    setHexDraft(value.toUpperCase());
    if (HEX.test(value)) setColor(value.toUpperCase());
  };

  const readLogo = (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/svg+xml"].includes(file.type)) {
      toast("Upload a PNG or SVG logo.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast(`Keep the logo under ${Math.round(MAX_LOGO_BYTES / 1024)} KB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => toast("Couldn't read that file.");
    reader.readAsDataURL(file);
  };

  const save = async () => {
    const parsed = brandSchema.safeParse({ company_name: company, brand_color: color, logo_url: logo, default_message: message });
    if (!parsed.success) {
      toast(parsed.error.issues[0]?.message || "Check the brand kit.");
      return;
    }
    setSaving(true);
    await run(() => saveBrand(account.id, parsed.data), "Brand kit saved");
    setSaving(false);
  };

  const previewMessage = message.trim() || "Thank you for everything you do.";

  return (
    <>
      <ViewHeader title="Brand kit" description="Your logo, colour and message on every cake, box and card." />

      <div className="grid gap-4 md:gap-6 min-[1001px]:grid-cols-[1fr_1.1fr]">
        <Card title="Your brand">
          <fieldset disabled={!editable} className="flex flex-col gap-4">
            <Field label="Company name" htmlFor="brand-company">
              <Input id="brand-company" value={company} maxLength={120} onChange={(event) => setCompany(event.target.value)} className="h-11" />
            </Field>

            <Field label="Brand colour" htmlFor="brand-hex" error={HEX.test(hexDraft) ? undefined : "Use a hex colour like #C40404."}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Pick brand colour"
                  value={color}
                  onChange={(event) => setBoth(event.target.value)}
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-line bg-card p-1"
                />
                <Input
                  id="brand-hex"
                  value={hexDraft}
                  maxLength={7}
                  onChange={(event) => setBoth(event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`)}
                  className="h-11 font-mono uppercase"
                />
              </div>
            </Field>

            <Field label="Logo" hint="PNG or SVG, transparent background, under 300 KB.">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-24 place-items-center rounded-xl border border-dashed border-line bg-surface">
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL preview
                    <img src={logo} alt="Current logo" className="max-h-12 max-w-20 object-contain" />
                  ) : (
                    <ImagePlus aria-hidden="true" className="h-5 w-5 text-muted" />
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  {logo ? "Replace" : "Upload logo"}
                </Button>
                {logo ? (
                  <Button type="button" variant="text" size="sm" onClick={() => setLogo(null)} aria-label="Remove logo">
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                ) : null}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/svg+xml"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(event) => {
                    readLogo(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </div>
            </Field>

            <Field label="Default message on cards" htmlFor="brand-message" hint={`${message.length}/300`}>
              <Textarea id="brand-message" value={message} maxLength={300} onChange={(event) => setMessage(event.target.value)} className="min-h-24" />
            </Field>
          </fieldset>

          {editable ? (
            <Button className="mt-5" onClick={save} disabled={saving || !HEX.test(hexDraft)}>
              {saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}
              Save brand kit
            </Button>
          ) : (
            <p className="mt-5 text-xs text-muted">Only admins and editors can change the brand kit.</p>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-4 md:gap-6">
          <Card title="Live preview">
            {/* The one place the company's colour drives the UI. */}
            <div style={{ "--company-brand": color } as CSSProperties} className="grid gap-3 sm:grid-cols-3 min-[1001px]:grid-cols-1 xl:grid-cols-3">
              <figure className="flex min-h-44 flex-col justify-between rounded-2xl p-4 text-white" style={{ backgroundColor: "var(--company-brand)" }}>
                <PreviewLogo logo={logo} company={company} tone="light" />
                <p className="line-clamp-3 text-sm font-semibold leading-snug">{previewMessage}</p>
                <figcaption className="text-[11px] uppercase tracking-wide text-white/75">Branded cake pack</figcaption>
              </figure>
              <figure className="flex min-h-44 flex-col justify-between rounded-2xl bg-neutral-950 p-4 text-white">
                <PreviewLogo logo={logo} company={company} tone="dark" />
                <p className="text-lg font-bold">Happy birthday</p>
                <figcaption className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/60">
                  <span aria-hidden="true" className="h-2 w-6 rounded-full" style={{ backgroundColor: "var(--company-brand)" }} />
                  Gift box sleeve
                </figcaption>
              </figure>
              <figure
                className="flex min-h-44 flex-col justify-between rounded-2xl p-4 text-white"
                style={{ backgroundImage: "linear-gradient(135deg, var(--company-brand), #FF7A1A)" }}
              >
                <PreviewLogo logo={logo} company={company} tone="light" />
                <p className="text-2xl font-bold tabular-nums">₦25,000</p>
                <figcaption className="text-[11px] uppercase tracking-wide text-white/80">Gift card · {company || "Your company"}</figcaption>
              </figure>
            </div>
          </Card>

          <Card title="House rules">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
              {BRAND_HOUSE_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
