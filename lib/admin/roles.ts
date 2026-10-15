export const ADMIN_ROLES = ["support", "operations", "growth", "finance", "admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminScreen =
  | "pulse"
  | "growth"
  | "calendar"
  | "wishlists"
  | "pools"
  | "demand"
  | "orders"
  | "corporate"
  | "diaspora"
  | "segments"
  | "money"
  | "people"
  | "reviews"
  | "enquiries"
  | "reminders";

// The permission matrix from 23-ADMIN-DASHBOARD-SPEC.md. Every page and
// /api/admin route checks against this; the sidebar only filters it.
export const SCREEN_ROLES: Record<AdminScreen, readonly AdminRole[]> = {
  pulse: ["support", "operations", "growth", "finance", "admin"],
  growth: ["growth", "admin"],
  calendar: ["operations", "growth", "admin"],
  wishlists: ["growth", "admin"],
  pools: ["operations", "growth", "finance", "admin"],
  demand: ["growth", "admin"],
  orders: ["operations", "finance", "admin"],
  corporate: ["operations", "growth", "finance", "admin"],
  diaspora: ["growth", "finance", "admin"],
  segments: ["growth", "admin"],
  money: ["finance", "admin"],
  people: ["support", "operations", "growth", "admin"],
  reviews: ["support", "growth", "admin"],
  enquiries: ["operations", "growth", "admin"],
  reminders: ["operations", "admin"],
};

// Actions narrower than the screen they live on. The spec limits order status
// changes to operations and admin. Paying out a pool moves money, so growth,
// which can see the Pools screen, cannot mark payouts.
export const ACTION_ROLES = {
  updateOrderStatus: ["operations", "admin"],
  updatePayout: ["operations", "finance", "admin"],
} as const satisfies Record<string, readonly AdminRole[]>;

export type AdminAction = keyof typeof ACTION_ROLES;

export interface AdminNavItem {
  screen: AdminScreen;
  href: string;
  label: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  { label: "Overview", items: [{ screen: "pulse", href: "/admin/pulse", label: "Pulse" }] },
  {
    label: "Growth",
    items: [
      { screen: "growth", href: "/admin/growth", label: "Growth & Cohorts" },
      { screen: "calendar", href: "/admin/calendar", label: "Calendar Engine" },
      { screen: "wishlists", href: "/admin/wishlists", label: "Wishlists" },
      { screen: "segments", href: "/admin/segments", label: "Segments" },
    ],
  },
  {
    label: "Operations",
    items: [
      { screen: "orders", href: "/admin/orders", label: "Orders" },
      { screen: "pools", href: "/admin/pools", label: "Pools" },
      { screen: "reminders", href: "/admin/reminders", label: "Reminder Failures" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { screen: "demand", href: "/admin/demand", label: "Demand" },
      { screen: "corporate", href: "/admin/corporate", label: "Corporate" },
      { screen: "diaspora", href: "/admin/diaspora", label: "Diaspora" },
    ],
  },
  { label: "Finance", items: [{ screen: "money", href: "/admin/money", label: "Money" }] },
  {
    label: "People",
    items: [
      { screen: "people", href: "/admin/people", label: "People" },
      { screen: "reviews", href: "/admin/reviews", label: "Reviews" },
    ],
  },
  { label: "Business", items: [{ screen: "enquiries", href: "/admin/enquiries", label: "Enquiries" }] },
];

export const ROLE_LABELS: Record<AdminRole, string> = {
  support: "Support",
  operations: "Operations",
  growth: "Growth",
  finance: "Finance",
  admin: "Admin",
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function canAccessScreen(role: AdminRole | null | undefined, screen: AdminScreen) {
  return Boolean(role && SCREEN_ROLES[screen].includes(role));
}

export function canPerform(role: AdminRole | null | undefined, action: AdminAction) {
  return Boolean(role && (ACTION_ROLES[action] as readonly AdminRole[]).includes(role));
}

export function navForRole(role: AdminRole): AdminNavGroup[] {
  return ADMIN_NAV
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccessScreen(role, item.screen)) }))
    .filter((group) => group.items.length > 0);
}

/** The nav entry a pathname belongs to, for the top bar's page title. */
export function navItemForPath(pathname: string): AdminNavItem | null {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return item;
    }
  }
  return null;
}
