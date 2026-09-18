import { CartProvider } from "@/components/cart/CartProvider";
import { ToastProvider } from "@/components/ui/Toast";

// The shared wishlist tree renders its own chrome rather than PublicPageShell,
// so it has to mount the cart itself: the giver item view adds catalog gifts to
// the same browser-local cart the storefront uses (see GiverItemActions).
export default function SharedWishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <ToastProvider>{children}</ToastProvider>
    </CartProvider>
  );
}
