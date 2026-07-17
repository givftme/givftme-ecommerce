import Image from "next/image";
import Link from "next/link";
import { Gift, Headphones, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/Button";

const perks = [
  {
    icon: Truck,
    title: "Affordable Delivery",
    description: "For all orders",
  },
  {
    icon: ShieldCheck,
    title: "Return Warranty",
    description: "If you are not satisfied",
  },
  {
    icon: Headphones,
    title: "24/7 Technical Support",
    description: "Anytime & anywhere you are",
  },
  {
    icon: Gift,
    title: "Member Gifts",
    description: "Discount coupons for members",
  },
];

const footerLinks = [
  { label: "Shop", href: "/shop" },
  { label: "Wishlist", href: "/dashboard/wishlists" },
  { label: "Contact Us", href: "/contact-us" },
  { label: "About Us", href: "/about-us" },
];

export function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4 lg:px-8">
        {perks.map((perk) => (
          <div key={perk.title} className="flex flex-col items-start gap-3">
            <perk.icon className="h-8 w-8 text-ink" strokeWidth={1.25} />
            <div>
              <p className="font-medium text-ink">{perk.title}</p>
              <p className="text-sm text-muted">{perk.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-12 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-surface">
          <Image
            src="/images/cut.png"
            alt=""
            fill
            className="object-cover"
            aria-hidden="true"
          />
          <div className="relative flex flex-col items-start gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <p className="max-w-sm text-lg font-medium text-ink">
              Be the first to know about our discount orders
            </p>
            <form className="flex w-full max-w-md items-center gap-2">
              <label className="sr-only" htmlFor="newsletter-email">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                placeholder="Enter your email..."
                className="h-11 w-full rounded-full border border-stone-200 bg-white px-5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <Button type="submit" variant="filled" size="md">
                Search
              </Button>
            </form>
          </div>
        </div>
      </div>

      <div className="border-t border-stone-100">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-muted sm:flex-row lg:px-8">
          <Image src="/logo.png" alt="Gifvtme" width={110} height={37} />
          <ul className="flex flex-wrap items-center justify-center gap-6">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p>&copy; {new Date().getFullYear()} Gifvtme. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
