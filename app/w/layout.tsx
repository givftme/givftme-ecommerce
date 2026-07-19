import { ToastProvider } from "@/components/ui/Toast";

export default function SharedWishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ToastProvider>{children}</ToastProvider>;
}
