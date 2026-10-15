// Constants for the business dashboard (24-BUSINESS-DASHBOARD-SPEC.md,
// "Data constants"). Occasion icons are lucide names; components resolve
// them through BizOccasionIcon.

export const OCCASIONS = [
  { key: 'Birthdays',             icon: 'cake',      color: '#C40404', note: 'Runs all year from your staff list' },
  { key: 'Work anniversaries',    icon: 'award',     color: '#6B3FD0', note: 'Milestone years: 1, 3, 5, 10' },
  { key: 'Customer Service Week', icon: 'headset',   color: '#2F5BD3', note: 'First full week of October' },
  { key: "Mother's Day",          icon: 'flower-2',  color: '#C4520A', note: 'March or April — date varies' },
  { key: "Father's Day",          icon: 'user-round', color: '#119650', note: 'Third Sunday in June' },
  { key: 'Eid / Sallah',          icon: 'moon',      color: '#8A5A00', note: 'Dates change each year' },
  { key: 'Independence Day',      icon: 'flag',      color: '#119650', note: '1 October' },
  { key: 'End of year',           icon: 'gift',      color: '#C40404', note: 'December — staff, clients and partners' },
  { key: 'New baby / wedding',    icon: 'baby',      color: '#6B3FD0', note: 'Life events, logged by HR' },
  { key: 'Sympathy',              icon: 'spa',       color: '#6E6E6E', note: 'Quiet packages — no branding, no fuss' },
] as const

export type OccasionKey = (typeof OCCASIONS)[number]['key']
export type OccasionIconName = (typeof OCCASIONS)[number]['icon']

export const GIFT_TYPES = [
  { label: 'Branded cake pack', desc: 'Baked and branded with your logo' },
  { label: 'Treat pack',        desc: 'Snacks and drinks, branded sleeve' },
  { label: 'Hamper',            desc: 'Mixed hamper in a branded box' },
  { label: 'Gift card',         desc: 'They choose; your logo on the card' },
  { label: 'Signature gift',    desc: 'Chosen per person, white-glove delivery' },
] as const

export const AUDIENCES = [
  { label: 'Everyone',              desc: 'All staff on file' },
  { label: 'One department',        desc: 'Pick a department' },
  { label: 'Staff who are mothers', desc: "Mother's Day" },
  { label: 'Staff who are fathers', desc: "Father's Day" },
  { label: 'Clients and partners',  desc: 'From your client list' },
  { label: 'Executives',            desc: 'MD, directors and board' },
] as const

export type AudienceLabel = (typeof AUDIENCES)[number]['label']

export const DEPARTMENTS = [
  'Finance', 'Sales', 'Operations', 'Technology', 'Customer Service',
  'People & Culture', 'Legal', 'Executive', 'Unassigned',
]

export const MILESTONE_YEARS = [1, 3, 5, 10, 15, 20]

export const DELIVERY_FEE_PER_GIFT = 2500 // ₦ — shown in cost estimates

// --- Beyond the spec's constant block, but named by its screens ---------

export const TIERS = ['Standard', 'Premium', 'Signature'] as const
export type GiftTier = (typeof TIERS)[number]

export const CAMPAIGN_STATUSES = ['Draft', 'Pending approval', 'Approved', 'Delivered'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]

export const RELATIONSHIPS = ['Client', 'Partner', 'Vendor', 'Board'] as const

/** Job roles offered on the Create account form (stored as business_users.department). */
export const SIGNUP_ROLES = [
  'HR / People',
  'Admin',
  'Marketing / Brand',
  'Executive Assistant',
  'Finance',
  'Founder / MD',
] as const

export const REMINDER_CHANNELS = ['WhatsApp and email', 'Email only', 'WhatsApp only'] as const
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number]

/** Reminders go out this many days before anything branded. */
export const REMINDER_LEAD_DAYS = [30, 14, 7]

/** A campaign delivered sooner than this gets the tight-timing warning. */
export const TIGHT_TIMING_DAYS = 21

export const RULES = [
  { key: 'staff_birthdays',      title: 'Staff birthdays',                         desc: 'A branded gift for every staff birthday on file, delivered on the day.', enabled: true },
  { key: 'work_anniversaries',   title: 'Work anniversaries (1, 3, 5, 10 years)',  desc: 'Mark milestone years with a gift sized to the milestone.',               enabled: true },
  { key: 'babies_weddings',      title: 'New babies and weddings',                 desc: 'When HR logs a life event, we send something thoughtful.',              enabled: false },
  { key: 'client_birthdays',     title: 'Client and partner birthdays',            desc: 'Keep relationships warm with a gift on their day.',                     enabled: true },
  { key: 'sympathy',             title: 'Sympathy packages',                       desc: 'Quiet packages — no branding, no fuss — when someone loses a loved one.', enabled: true },
  { key: 'quiet_month_reminder', title: 'Remind me when a month is quiet',         desc: "We'll nudge you when a month has nothing planned.",                     enabled: true },
] as const

export type RuleKey = (typeof RULES)[number]['key']

export const BUSINESS_ROLES = ['admin', 'editor', 'approver', 'limited'] as const
export type BusinessRole = (typeof BUSINESS_ROLES)[number]

export const BUSINESS_ROLE_LABELS: Record<BusinessRole, string> = {
  admin: 'Admin',
  editor: 'Editor',
  approver: 'Approver',
  limited: 'Limited',
}

export const APPROVAL_FLOW = ['HR plans', 'Finance approves', 'Givftme produces', 'Delivered with photos'] as const

export const BRAND_HOUSE_RULES = [
  'Logos print best as PNG or SVG on a transparent background.',
  'We match your colour as closely as print and icing allow.',
  'Sympathy packages never carry branding.',
  'Messages over 120 characters are shortened on cake packs.',
] as const

export const AUTH_FEATURES = [
  'Upload a staff or client list from Excel in minutes',
  'Every birthday and work anniversary on one calendar',
  'Plan, approve and track campaigns with Finance',
  'Branded gifts, proof of delivery, one invoice',
] as const
