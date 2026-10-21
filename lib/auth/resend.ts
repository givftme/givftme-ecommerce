// Resending a sign-up confirmation link. Client-safe (no server dependencies).

/** Supabase lets one address request a new link about once a minute. */
export const RESEND_COOLDOWN_SECONDS = 60;

const RATE_LIMIT_CODES = new Set(["over_email_send_rate_limit", "over_request_rate_limit"]);

/**
 * What to tell someone whose resend failed, and whether to make them wait
 * before trying again. A failure can also mean the email is already
 * confirmed (a link opened on another device), so the copy points at sign-in.
 */
export function resendFailure(error: { status?: number; code?: string } | null | undefined) {
  if (error && (error.status === 429 || (error.code && RATE_LIMIT_CODES.has(error.code)))) {
    return { message: "Too many links requested. Wait a minute, then try again.", cooldown: true };
  }
  return {
    message: "Couldn't send a new link. If you've already confirmed your email, sign in instead. Otherwise try again in a minute.",
    cooldown: false,
  };
}
