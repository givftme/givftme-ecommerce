export function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabasePublicEnv() {
  return {
    url: requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      "NEXT_PUBLIC_SUPABASE_URL"
    ),
    anonKey: requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    ),
  };
}

export function getAppUrl() {
  return requireEnv(process.env.NEXT_PUBLIC_APP_URL, "NEXT_PUBLIC_APP_URL").replace(
    /\/$/,
    ""
  );
}

export function validateAuthEnv() {
  getSupabasePublicEnv();
  getAppUrl();
  requireEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
}
