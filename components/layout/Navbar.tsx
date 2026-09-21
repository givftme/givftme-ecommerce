"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CalendarHeart,
  ChevronDown,
  ChevronUp,
  Clock,
  Home,
  Info,
  ListChecks,
  Mail,
  Menu,
  Search,
  ShoppingBag,
  ShoppingCart,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { FlashSaleNavbarStrip } from "@/components/flash-sale/FlashSaleNavbarStrip";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const navLinks: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Account", href: "/account", icon: User },
  { label: "Shop", href: "/shop", icon: ShoppingBag },
  { label: "Save Special Dates", href: "/dates", icon: CalendarHeart },
  { label: "Wishlist", href: "/wishlists", icon: ListChecks },
  // { label: "Contact Us", href: "/contact-us", icon: Mail },
  // { label: "About Us", href: "/about-us", icon: Info },
];

/** Red underline that grows from the left on hover and stays on the active link. */
const underline =
  "relative py-1 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:origin-left after:bg-brand after:transition-transform after:duration-300 after:content-[''] hover:after:scale-x-100";

export interface NavbarProps {
  cartCount?: number;
  cartPulseKey?: number;
  userName?: string;
  avatarUrl?: string;
  isAuthenticated?: boolean;
  searchQuery?: string;
  flashSaleEndTime?: string | null;
  flashSaleMaxDiscountPercent?: number | null;
}

export function Navbar({
  cartCount = 0,
  cartPulseKey = 0,
  userName,
  avatarUrl,
  isAuthenticated = false,
  searchQuery,
  flashSaleEndTime,
  flashSaleMaxDiscountPercent,
}: NavbarProps) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecentlyViewedOpen, setIsRecentlyViewedOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const desktopCartRef = useRef<HTMLAnchorElement>(null);
  const mobileCartRef = useRef<HTMLAnchorElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const accountHref = isAuthenticated ? "/account" : "/login";
  const accountSecondaryLabel = isAuthenticated ? "My Account" : "Sign In / Log In";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  useGSAP(
    () => {
      if (cartPulseKey === 0) {
        return;
      }

      const targets = [desktopCartRef.current, mobileCartRef.current].filter(Boolean);
      gsap.to(targets, {
        scale: 1.12,
        duration: 0.18,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
      });
    },
    { dependencies: [cartPulseKey] }
  );

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isMobileSearchOpen) {
      return;
    }

    mobileSearchInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileSearchOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMobileSearchOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-white/90 backdrop-blur-[14px] backdrop-saturate-150 transition-colors duration-300",
        isScrolled ? "border-line" : "border-transparent"
      )}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-6 px-4 max-sm:h-16 lg:px-8">
        <Link href="/" aria-label="Gifvtme home" className="shrink-0">
          <Image
            src="/logo.png"
            alt="Gifvtme"
            width={132}
            height={44}
            preload
            className="h-8.5 w-auto max-sm:h-7.5"
          />
        </Link>

        <form
          action="/search"
          method="get"
          role="search"
          className="hidden flex-1 justify-center md:flex"
        >
          <div className="relative flex w-full max-w-md items-center">
            <label htmlFor="navbar-search" className="sr-only">
              Search products
            </label>
            <input
              id="navbar-search"
              name="q"
              type="search"
              defaultValue={searchQuery}
              placeholder="Electronic blender"
              className="h-11 w-full rounded-full border border-line bg-white pl-5 pr-12 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
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

        <div className="ml-auto flex items-center gap-2.5 md:ml-0">
          <button
            type="button"
            aria-label="Search"
            onClick={() => setIsMobileSearchOpen(true)}
            className="inline-flex size-10 items-center justify-center rounded-full text-ink md:hidden"
          >
            <Search className="h-5 w-5" strokeWidth={1.75} />
          </button>

          {isAuthenticated ? (
            <>
              <Link
                href={accountHref}
                aria-label={accountSecondaryLabel}
                className="hidden size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface md:inline-flex"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : userName ? (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="h-6 w-6" strokeWidth={1.5} />
                )}
              </Link>

              <Link
                ref={desktopCartRef}
                href="/cart"
                className="hidden h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark md:inline-flex"
              >
                <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
                Cart
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-brand">
                  {cartCount}
                </span>
              </Link>

              <Link
                ref={mobileCartRef}
                href="/cart"
                aria-label="Cart"
                className="relative inline-flex size-10 items-center justify-center rounded-full text-ink md:hidden"
              >
                <ShoppingCart className="h-5 w-5" strokeWidth={1.75} />
                {cartCount > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] text-white">
                    {cartCount}
                  </span>
                )}
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-full bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark max-sm:h-10 max-sm:px-4 max-sm:text-[13.5px]"
            >
              Get started
            </Link>
          )}

          <button
            type="button"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls="nav-drawer"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="inline-flex size-10 items-center justify-center rounded-full border border-line bg-white text-ink md:hidden"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <FlashSaleNavbarStrip
        saleEndTime={flashSaleEndTime}
        maxDiscountPercent={flashSaleMaxDiscountPercent}
      />

      <nav aria-label="Main" className="hidden md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 lg:px-8">
          <ul className="flex items-center gap-7 py-3 text-[14.5px] font-medium text-ink">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    underline,
                    isActive(link.href) ? "after:scale-x-100" : "after:scale-x-0"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setIsRecentlyViewedOpen((open) => !open)}
            className={cn(underline, "after:scale-x-0 flex items-center gap-2 text-[14.5px] font-medium text-ink")}
          >
            <Clock className="h-4 w-4 text-brand" />
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
        id="nav-drawer"
        className={cn(
          "flex-col border-t border-line bg-white px-5.5 pt-1.5 pb-5 md:hidden",
          isMenuOpen ? "flex" : "hidden"
        )}
      >
        {navLinks.map(({ label, href, icon: LinkIcon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            onClick={() => setIsMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 border-b border-line py-3.5 font-medium",
              isActive(href) ? "text-brand" : "text-ink"
            )}
          >
            <LinkIcon className="h-5 w-5 text-brand" />
            {label}
          </Link>
        ))}
        <Link
          href={accountHref}
          onClick={() => setIsMenuOpen(false)}
          className="flex items-center gap-3 border-b border-line py-3.5 font-medium text-ink"
        >
          <User className="h-5 w-5 text-brand" />
          {accountSecondaryLabel}
        </Link>
      </div>

      {isMobileSearchOpen ? (
        <div className="fixed inset-0 z-60 bg-white md:hidden">
          <div className="flex items-center gap-3 border-b border-line px-4 py-4">
            <form
              action="/search"
              method="get"
              role="search"
              className="flex-1"
              onSubmit={() => setIsMobileSearchOpen(false)}
            >
              <label htmlFor="mobile-search" className="sr-only">
                Search products
              </label>
              <input
                ref={mobileSearchInputRef}
                id="mobile-search"
                name="q"
                type="search"
                defaultValue={searchQuery}
                placeholder="Electronic blender"
                className="h-11 w-full rounded-full border border-line bg-white px-5 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </form>
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setIsMobileSearchOpen(false)}
              className="text-ink"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
