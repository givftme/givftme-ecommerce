"use client";

import { createClient } from "@/lib/supabase/client";
import { WISHLIST_IMAGES_BUCKET } from "@/lib/wishlist/images";

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 5 * 1024 * 1024;

export async function uploadWishlistImage(file: File) {
  if (!allowedImageTypes.includes(file.type)) {
    throw new Error("Please upload a JPEG, PNG, or WebP image.");
  }

  if (file.size > maxImageSize) {
    throw new Error("Image must be 5MB or smaller.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You need to sign in first.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

  const { data, error } = await supabase.storage
    .from(WISHLIST_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error || !data) {
    throw new Error(error?.message || "Couldn't upload photo.");
  }

  return data.path;
}
