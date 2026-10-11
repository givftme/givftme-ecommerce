import { createClient } from "@/lib/supabase/client";
import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_SIZE } from "@/lib/account/validation";

export const AVATARS_BUCKET = "avatars";

export function getAvatarStoragePath(publicUrl: string, userId: string) {
  const marker = `/${AVATARS_BUCKET}/`;
  const index = publicUrl.indexOf(marker);

  if (index === -1) {
    return null;
  }

  const path = decodeURIComponent(publicUrl.slice(index + marker.length).split(/[?#]/, 1)[0]);
  return path.startsWith(`${userId}/`) ? path : null;
}

export async function uploadAvatar(file: File, userId: string) {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
    throw new Error("Please upload a JPG, PNG, or WebP image");
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("Photo must be under 5MB");
  }

  const supabase = createClient();
  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  } as const;
  const path = `${userId}/avatar.${extensionByType[file.type as keyof typeof extensionByType]}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true, cacheControl: "0" });

  if (uploadError) {
    throw new Error("Couldn't upload photo. Try again.");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("users")
    .update({ avatar_url: publicUrl })
    .eq("id", userId);

  if (updateError) {
    throw new Error("Couldn't save your changes. Please try again.");
  }

  return `${publicUrl}?updated=${Date.now()}`;
}

export async function removeAvatar(currentAvatarUrl: string, userId: string) {
  const supabase = createClient();
  const path = getAvatarStoragePath(currentAvatarUrl, userId);

  if (path) {
    await supabase.storage.from(AVATARS_BUCKET).remove([path]);
  }

  const { error } = await supabase
    .from("users")
    .update({ avatar_url: null })
    .eq("id", userId);

  if (error) {
    throw new Error("Couldn't save your changes. Please try again.");
  }
}
