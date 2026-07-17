"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ChevronUp,
  ChevronDown,
  Clock,
  Menu,
  QrCode,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Account", href: "/account" },
  { label: "Shop", href: "/shop" },
  { label: "Save Special Dates", href: "/dates" },
  { label: "Wishlist", href: "/wishlists" },
  { label: "Contact Us", href: "/contact-us" },
  { label: "About Us", href: "/about-us" },
];

export interface NavbarProps {
  cartCount?: number;
  userName?: string;
  isAuthenticated?: boolean;
}

export function Navbar({
  cartCount = 0,
  userName,
  isAuthenticated = false,
}: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecentlyViewedOpen, setIsRecentlyViewedOpen] = useState(false);
  const accountHref = isAuthenticated ? "/account" : "/login";
  const accountPrimaryLabel = userName
    ? `Welcome, ${userName}`
    : isAuthenticated
      ? "Welcome back"
      : "Welcome";
  const accountSecondaryLabel = isAuthenticated ? "My Account" : "Sign In / Log In";

  return (
    <header className="sticky top-0 z-50 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 lg:px-8">
        <Link href="/" className="shrink-0">
          <Image src="/logo.png" alt="Gifvtme" width={132} height={44} priority />
        </Link>

        <form
          action="/shop"
          method="get"
          role="search"
          className="hidden flex-1 md:block"
        >
          <div className="relative flex max-w-md items-center">
            <label htmlFor="navbar-search" className="sr-only">
              Search products
            </label>
            <input
              id="navbar-search"
              name="q"
              type="search"
              placeholder="Electronic blender"
              className="h-11 w-full rounded-full border border-stone-200 bg-white pl-5 pr-12 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="submit"
              aria-label="Search"
              className="absolute right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>

        <div className="hidden items-center gap-6 md:flex">
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
          >
            <QrCode className="h-6 w-6" strokeWidth={1.5} />
            <span className="text-left leading-tight">
              Download the
              <br />
              givftme app
            </span>
          </button>

          <Link
            href={accountHref}
            className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
          >
            <User className="h-6 w-6" strokeWidth={1.5} />
            <span className="text-left leading-tight">
              {accountPrimaryLabel}
              <br />
              {accountSecondaryLabel}
            </span>
          </Link>

          <Link
            href="/cart"
            className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
          >
            <ShoppingCart className="h-6 w-6" strokeWidth={1.5} />
            <span className="text-left leading-tight">
              {cartCount}
              <br />
              Cart
            </span>
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-4 md:hidden">
          <Link href="/cart" aria-label="Cart" className="relative text-ink">
            <ShoppingCart className="h-6 w-6" strokeWidth={1.5} />
            {cartCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="text-ink"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <nav className="hidden bg-brand md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 lg:px-8">
          <ul className="flex items-center gap-6 py-3 text-sm text-white">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-opacity hover:opacity-80">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setIsRecentlyViewedOpen((open) => !open)}
            className="flex items-center gap-2 py-3 text-sm text-white transition-opacity hover:opacity-80"
          >
            <Clock className="h-4 w-4" />
            Recently Viewed
            {isRecentlyViewedOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </nav>

      <div
        className={cn(
          "border-t border-stone-100 md:hidden",
          isMenuOpen ? "block" : "hidden"
        )}
      >
        <ul className="flex flex-col divide-y divide-stone-100 px-4">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="block py-3 text-sm text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={accountHref}
              onClick={() => setIsMenuOpen(false)}
              className="block py-3 text-sm text-ink"
            >
              {accountSecondaryLabel}
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
