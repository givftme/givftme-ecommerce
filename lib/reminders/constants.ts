// Shared across every reminder source (important date, occasion, invitee) —
// business rule #17 fixes reminder timing at 14 and 3 days before the date;
// don't introduce additional windows without that being a deliberate call.
export const REMINDER_WINDOWS = [14, 3] as const;

// "push" intentionally excluded — no push subscription storage or
// FCM/APNs/web-push integration exists anywhere in this codebase, and
// /api/reminders' cron only ever dispatches channel="email". Scheduling a
// "push" row here would create a reminder with no possible delivery path,
// left queued forever (and, for a recurring important date, recreated every
// single year on top of the last). Re-add once push delivery is actually
// built.
export const REMINDER_CHANNELS = ["email"] as const;

export function subDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}
