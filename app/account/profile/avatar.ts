import { createClient } from "@/lib/supabase/client";
import { ALLOWED_AVATAR_TYPES, MAX_AVATAR_SIZE } from "@/lib/account/validation";

export const AVATARS_BUCKET = "avatars";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export function getAvatarStoragePath(publicUrl: string, userId: string) {
  const marker = `/${AVATARS_BUCKET}/`;
  const index = publicUrl.indexOf(marker);

  if (index === -1) {
    return null;
  }

  const path = decodeURIComponent(publicUrl.slice(index + marker.length));
  return path.startsWith(`${userId}/`) ? path : null;
}

export async function uploadAvatar(file: File, userId: string) {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
    throw new Error("Please upload a JPEG, PNG, or WebP image.");
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("Image must be under 5MB.");
  }

  const supabase = createClient();
  const path = `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    throw new Error("Upload failed. Please try again.");
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

  return publicUrl;
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
