"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, Home, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Home", href: "/", icon: Home },
  { label: "Wishlist", href: "/wishlists", icon: Gift },
  { label: "Account", href: "/account", icon: User },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-stone-100 bg-white md:hidden">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs",
              isActive ? "text-brand" : "text-muted"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 1.75} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
