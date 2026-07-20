import { Gift, Headphones, ShieldCheck, Truck } from "lucide-react";

const badges = [
  { icon: Truck, label: "Affordable Delivery" },
  { icon: ShieldCheck, label: "Return Warranty" },
  { icon: Headphones, label: "24/7 Support" },
  { icon: Gift, label: "Member Gifts" },
];

export function TrustBadges() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {badges.map((badge) => {
          const Icon = badge.icon;

          return (
            <div
              key={badge.label}
              className="rounded-2xl border border-stone-100 bg-white p-5 text-center shadow-sm"
            >
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-light text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{badge.label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
