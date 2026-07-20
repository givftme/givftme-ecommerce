"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/components/cart/CartProvider";
import { useCart } from "@/components/cart/CartContext";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Navbar } from "@/components/layout/Navbar";
import { ToastProvider } from "@/components/ui/Toast";

interface PublicPageShellProps {
  children: ReactNode;
  userName?: string;
  isAuthenticated?: boolean;
  searchQuery?: string;
}

function CartAwareChrome({
  children,
  userName,
  isAuthenticated,
  searchQuery,
}: PublicPageShellProps) {
  const { totalItems, pulseKey } = useCart();

  return (
    <ToastProvider>
      <Navbar
        cartCount={totalItems}
        cartPulseKey={pulseKey}
        userName={userName}
        isAuthenticated={isAuthenticated}
        searchQuery={searchQuery}
      />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <MobileBottomNav />
    </ToastProvider>
  );
}

export function PublicPageShell(props: PublicPageShellProps) {
  return (
    <CartProvider>
      <CartAwareChrome {...props} />
    </CartProvider>
  );
}
