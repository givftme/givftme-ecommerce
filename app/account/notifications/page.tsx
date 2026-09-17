import Link from "next/link";

export default function NotificationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink md:text-3xl">Notifications &amp; Reminders</h1>
      <p className="mt-3 text-sm leading-6 text-muted">A home for your notification and reminder preferences.</p>
      <section className="mt-8 rounded-xl bg-surface p-5" aria-labelledby="global-preferences">
        <h2 id="global-preferences" className="text-base font-semibold text-ink">Global preferences</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Account-wide reminder settings are not available yet. This page does not change any existing reminders.</p>
        <p className="mt-3 text-sm leading-6 text-muted">You can view your saved dates in Dates. To stop an existing email reminder, use the unsubscribe link in that reminder email.</p>
        <Link href="/dates" className="mt-4 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">View your dates</Link>
      </section>
      <section className="mt-8" aria-labelledby="reminder-channels">
        <h2 id="reminder-channels" className="text-base font-semibold text-ink">Reminder channels</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Email preferences, push notifications and messaging options will appear here when they are ready to use. There are no channel controls to enable at this time.</p>
      </section>
    </div>
  );
}
