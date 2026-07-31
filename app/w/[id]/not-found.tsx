import { SharedWishlistNotice } from "@/components/wishlist/SharedWishlistNotice";

export default function SharedWishlistNotFound() {
  return (
    <SharedWishlistNotice
      title="This wishlist link isn't valid or has expired."
      description="Double-check the link, or ask the owner to share a new one."
    />
  );
}
