import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withRedirect } from "@/lib/auth/redirect";

export default async function SecurityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(withRedirect("/login", "/account/security"));
  const methods = [
    { provider: "email", label: "Email", detail: "Use your existing email sign-in flow." },
    { provider: "google", label: "Google", detail: "Sign in with your connected Google account." },
  ].flatMap(method => {
    const identity = user.identities?.find(identity => identity.provider === method.provider);
    return identity ? [{ ...method, email: typeof identity.identity_data?.email === "string" ? identity.identity_data.email : null }] : [];
  });
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink md:text-3xl">Sign-in &amp; Security</h1>
      <p className="mt-3 text-sm leading-6 text-muted">The sign-in methods connected to your account.</p>
      <section className="mt-8" aria-labelledby="connected-methods">
        <h2 id="connected-methods" className="text-base font-semibold text-ink">Connected methods</h2>
        {methods.length ? (
          <ul className="mt-4 divide-y divide-stone-100">
            {methods.map(method => (
              <li key={method.provider} className="py-5 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{method.label}</h3>
                  <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted">Connected</span>
                </div>
                {method.email && <p className="mt-2 break-all text-sm text-ink">{method.email}</p>}
                <p className="mt-2 text-sm leading-6 text-muted">{method.detail}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-4 text-sm text-muted">No supported sign-in method details are available for this account.</p>}
      </section>
      <section className="mt-6 rounded-xl bg-surface p-5" aria-labelledby="more-methods">
        <h2 id="more-methods" className="text-base font-semibold text-ink">More ways to sign in</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Phone sign-in and adding or removing sign-in methods are not available yet. A phone number saved in Profile is contact information, not a phone sign-in method.</p>
      </section>
    </div>
  );
}
