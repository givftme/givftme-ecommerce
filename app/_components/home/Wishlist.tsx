"use client";

import { type SubmitEvent, useState } from "react";
import {
  Briefcase,
  Check,
  EyeOff,
  Link as LinkIcon,
  ListChecks,
  Lock,
  Plus,
  Share2,
  X,
} from "lucide-react";
import {
  Btn,
  Eyebrow,
  Icon,
  Pill,
  Reveal,
  SmartImage,
  Wrap,
  cx,
} from "@/components/ui/primitives";
import { useFeedback } from "@/hooks/useFeedback";
import { formatPrice } from "@/lib/utils";

interface WishItem {
  id: string;
  title: string;
  meta: string;
  image?: string;
  url?: string;
  action: "give" | "claimed" | "chip";
  giving?: boolean;
}

const SEED_ITEMS: WishItem[] = [
  {
    id: "new-chapter",
    title: "The New Chapter Box",
    meta: `${formatPrice(25000)} · Must have`,
    action: "give",
    image:
      "https://cdn.sanity.io/images/spvd4gp2/production/cf643a20c63cf1e05320c8af8412d563403e4249-1254x1254.png?w=160",
  },
  {
    id: "sweet-home",
    title: "Sweet Home Box",
    meta: `${formatPrice(30000)} · Would love`,
    action: "claimed",
    image:
      "https://cdn.sanity.io/images/spvd4gp2/production/fd6619ed68739f5077ca122eb99f07370ed591b4-1254x1254.png?w=160",
  },
  {
    id: "weekender",
    title: "Leather weekender bag",
    meta: "From a link · Pool preview",
    action: "chip",
  },
];
const FEATURES = [
  { icon: LinkIcon, label: "Paste links from any shop" },
  { icon: EyeOff, label: "Claims stay secret" },
  { icon: Share2, label: "Share to WhatsApp or your status" },
];
const ACTION =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export default function Wishlist() {
  const [items, setItems] = useState(SEED_ITEMS);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const { toast } = useFeedback();

  function addItem(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = link.trim();
    if (!value) {
      setError("Paste a product link first.");
      return;
    }
    let url: URL;
    try {
      url = new URL(
        /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : "https://" + value,
      );
      if (
        !["http:", "https:"].includes(url.protocol) ||
        !url.hostname.includes(".") ||
        url.username ||
        url.password
      )
        throw new Error("Invalid URL");
      url.hash = "";
    } catch {
      setError(
        "Enter a valid http or https product link, like jumia.com.ng/product.",
      );
      return;
    }
    if (items.some((item) => item.url === url.href)) {
      setError("That link is already in the demo list.");
      return;
    }
    setItems((current) => [
      {
        id: url.href,
        url: url.href,
        title: "Item from " + url.hostname.replace(/^www\./, ""),
        meta: "From your link · Would love",
        action: "give",
      },
      ...current,
    ]);
    setError("");
    setLink("");
    toast("Added to the demo. Create your own wishlist to save gifts.");
  }

  async function share() {
    const url = new URL("/#wishlist", window.location.origin).href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Try the Givtme wishlist demo", url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Demo link copied. Your sample changes are not shared.");
    } catch {
      setShareUrl(url);
    }
  }

  return (
    <section
      id="wishlist"
      aria-labelledby="wishlist-heading"
      className="scroll-mt-24 bg-soft py-16 sm:py-24"
    >
      <Wrap className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="flex min-w-0 flex-col gap-5">
          <Eyebrow tone="brand">
            <Icon as={ListChecks} size={16} />
            Wishlists
          </Eyebrow>
          <h2
            id="wishlist-heading"
            className="font-display text-4xl leading-tight sm:text-5xl"
          >
            Stop hinting. Share a list.
          </h2>
          <p className="max-w-[30em] text-base text-muted">
            Add anything, from any store. Friends claim quietly, so the surprise
            stays.
          </p>
          <p id="wishlist-demo-note" className="text-sm text-muted">
            Try this sample list. Changes stay in this preview and reset when
            you leave.
          </p>
          <form
            onSubmit={addItem}
            noValidate
            className="flex max-w-[460px] gap-2 rounded-full border border-line bg-white p-1.5 shadow-soft focus-within:ring-2 focus-within:ring-brand"
          >
            <label htmlFor="paste-input" className="sr-only">
              Paste a product link
            </label>
            <input
              id="paste-input"
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder="Paste a product link…"
              value={link}
              aria-invalid={!!error}
              aria-describedby={
                error
                  ? "wishlist-link-error wishlist-demo-note"
                  : "wishlist-demo-note"
              }
              onChange={(event) => {
                setLink(event.target.value);
                setError("");
              }}
              className="min-w-0 flex-1 rounded-full bg-transparent px-3 text-sm text-ink outline-none"
            />
            <Btn type="submit" tone="brand">
              <Icon as={Plus} size={16} />
              Add
            </Btn>
          </form>
          {error && (
            <p
              id="wishlist-link-error"
              role="alert"
              className="text-sm text-brand"
            >
              {error}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {FEATURES.map(({ icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-brand">
                  <Icon as={icon} />
                </span>
                {label}
              </li>
            ))}
          </ul>
          <div>
            <Btn as="a" href="/wishlists" tone="brand">
              Create your own wishlist
              <Icon as={Plus} size={16} />
            </Btn>
          </div>
        </Reveal>
        <Reveal delay={0.15} className="min-w-0">
          <div className="mx-auto w-full max-w-[460px] overflow-hidden rounded-3xl bg-white shadow-float">
            <div className="relative h-40 bg-peach">
              <SmartImage
                src="/images/hero-carousel-image-01.png"
                alt="Family celebrating a shared meal"
                loading="lazy"
                className="size-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-linear-to-t from-black/80 to-transparent"
              />
              <Pill tone="brand" className="absolute top-4 right-4">
                Sample wishlist
              </Pill>
              <div className="absolute bottom-4 left-5 text-white">
                <h3 className="font-display text-3xl">Adaeze’s 30th</h3>
                <span className="text-sm">Lagos</span>
              </div>
            </div>
            <ul
              className="max-h-[420px] overflow-y-auto px-5"
              aria-label="Demo wishlist items"
            >
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 border-b border-line py-4 last:border-b-0"
                >
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-soft text-brand">
                    {item.image ? (
                      <SmartImage
                        src={item.image}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <Icon as={item.url ? LinkIcon : Briefcase} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate font-medium underline underline-offset-2"
                      >
                        {item.title}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <b className="block font-medium">{item.title}</b>
                    )}
                    <span className="text-xs text-muted">{item.meta}</span>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                    {item.action === "claimed" ? (
                      <span
                        className={cx(ACTION, "border-soft bg-soft text-muted")}
                      >
                        <Icon as={Lock} size={14} />
                        Claimed
                      </span>
                    ) : item.action === "chip" ? (
                      <a
                        href="#pool"
                        className={cx(ACTION, "border-line bg-white text-ink")}
                      >
                        Try pooling
                      </a>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={!!item.giving}
                        onClick={() => {
                          setItems((current) =>
                            current.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, giving: !entry.giving }
                                : entry,
                            ),
                          );
                          toast(
                            item.giving
                              ? "Demo claim removed"
                              : "Claimed in this preview only",
                          );
                        }}
                        className={cx(
                          ACTION,
                          "cursor-pointer",
                          item.giving
                            ? "border-green-50 bg-green-50 text-green"
                            : "border-ink bg-ink text-white",
                        )}
                      >
                        {item.giving && <Icon as={Check} size={14} />}
                        {item.giving ? "You’re giving" : "Try claiming"}
                      </button>
                    )}
                    {item.url && (
                      <button
                        type="button"
                        aria-label={`Remove ${item.title}`}
                        className="grid size-11 place-items-center rounded-full text-muted hover:bg-soft focus-visible:outline-2 focus-visible:outline-brand"
                        onClick={() => {
                          setItems((current) =>
                            current.filter((entry) => entry.id !== item.id),
                          );
                          document.getElementById("paste-input")?.focus();
                        }}
                      >
                        <Icon as={X} size={16} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-soft px-5 py-4">
              <span className="text-xs text-muted">
                Sample changes are not shared
              </span>
              <Btn type="button" tone="ink" onClick={share}>
                <Icon as={Share2} size={16} />
                Share demo
              </Btn>
            </div>
            {shareUrl && (
              <div className="border-t border-line p-5">
                <label
                  htmlFor="wishlist-share-url"
                  className="text-sm text-muted"
                >
                  Copy this demo link
                </label>
                <input
                  id="wishlist-share-url"
                  readOnly
                  value={shareUrl}
                  onFocus={(event) => event.currentTarget.select()}
                  className="mt-2 w-full rounded-xl border border-line p-3 text-sm focus-visible:outline-2 focus-visible:outline-brand"
                />
              </div>
            )}
          </div>
        </Reveal>
      </Wrap>
    </section>
  );
}
