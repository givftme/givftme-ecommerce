import {
  type LucideIcon,
  Award,
  Baby,
  Briefcase,
  Cake,
  CakeSlice,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Crown,
  Egg,
  Flag,
  Flower2,
  Gift,
  Handshake,
  HardHat,
  Headset,
  Heart,
  HeartHandshake,
  Package,
  PartyPopper,
  Plane,
  Sparkles,
  Sunrise,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { BusinessOccasion } from "@/lib/business/validation";
import type { PlannerOccasion } from "@/lib/business/planner";

/**
 * Experience Centre contact settings. Fill these in before going live: an
 * empty value keeps its contact option visible but inert. Briefs post to
 * `enquiryEndpoint`, which saves them for the admin Enquiries screen.
 */
export const CONTACT = {
  /** International format without "+", e.g. "2348012345678". */
  whatsappNumber: "",
  whatsappLabel: "[WhatsApp number]",
  email: "",
  emailLabel: "[business email]",
  phone: "",
  phoneLabel: "[phone number]",
  /** Accepts the brief as a JSON POST (app/api/business/enquiry). */
  enquiryEndpoint: "/api/business/enquiry",
};

export const WHATSAPP_GREETING =
  "Hi Givftme, I’d like to plan corporate gifting for my company.";

/**
 * The Givftme logo (wordmark and tagline). `crop` is the visible artwork inside
 * the padded file, so small placements can show the mark without its margins.
 */
export const LOGO = {
  src: "/logo.png",
  width: 248,
  height: 154,
  crop: { x: 47, y: 59, w: 156, h: 50 },
};

export const DEFAULT_BRAND_NAME = "Your Company";

export const STUDIO_MESSAGES = [
  "Happy Birthday!",
  "Happy Customer Service Week",
  "Happy Father’s Day",
  "Happy Mother’s Day",
  "Thank you, partner",
  "Season’s Greetings",
  "Welcome to the team",
];

/** Starter brand colours for the studio. These are the visitor's colours, not ours. */
export const BRAND_SWATCHES = [
  { label: "Navy", value: "#1b2b5e" },
  { label: "Green", value: "#0f6b4f" },
  { label: "Red", value: "#e11d2e" },
  { label: "Purple", value: "#5b2a86" },
  { label: "Black", value: "#151515" },
];

export const MARQUEE_ITEMS: { icon: LucideIcon; label: string }[] = [
  { icon: CakeSlice, label: "Branded cakes" },
  { icon: Package, label: "Custom cake packs" },
  { icon: CreditCard, label: "Gift cards" },
  { icon: Gift, label: "Hampers" },
  { icon: Crown, label: "Executive gifts" },
  { icon: PartyPopper, label: "Team hangouts" },
  { icon: Briefcase, label: "Welcome kits" },
  { icon: Award, label: "Long-service awards" },
  { icon: Headset, label: "Customer Service Week" },
  { icon: Sparkles, label: "End-of-year packages" },
];

export type PlanName = "Pulse" | "Seasons" | "Signature";

export interface Moment {
  icon: LucideIcon;
  title: string;
  when: string;
  who: string;
  blurb: string;
  inside: string[];
  brand: string[];
  plan: PlanName;
  /** The Experience Centre chip this moment preselects. */
  occasion: BusinessOccasion;
}

export const MOMENTS: Moment[] = [
  {
    icon: Cake,
    title: "Team birthdays",
    when: "Everyone, on their day",
    who: "For every staff member",
    blurb: "A branded cake or cake pack lands on the day — with a card from their team lead.",
    inside: ["Branded cake or cake pack", "Card signed by the team", "Desk or home delivery", "Photo sent to HR"],
    brand: ["Logo on the cake pack", "Company colours on the cake", "Your birthday message"],
    plan: "Pulse",
    occasion: "Team birthdays",
  },
  {
    icon: Headset,
    title: "Customer Service Week",
    when: "October · for your front-liners",
    who: "For customer-facing teams",
    blurb:
      "Make the whole week feel different. Branded treats, daily surprises and a thank-you from leadership.",
    inside: ["Branded treat pack per agent", "A surprise drop each day", "Thank-you card from the MD", "Team cake for the finale"],
    brand: ["“Happy CSW” packaging in your colours", "Custom sleeve on every pack", "Optional branded merch"],
    plan: "Seasons",
    occasion: "Customer Service Week",
  },
  {
    icon: HeartHandshake,
    title: "Father’s & Mother’s Day",
    when: "June · March/April",
    who: "For the parents on your team",
    blurb: "A thoughtful gift that says the company sees them as more than staff.",
    inside: ["Curated gift per parent", "Personal note from the company", "Optional family treat box"],
    brand: ["Branded gift box and card", "Your message inside"],
    plan: "Seasons",
    occasion: "Father’s / Mother’s Day",
  },
  {
    icon: Crown,
    title: "MDs, CEOs & Directors",
    when: "Birthdays, appointments, milestones",
    who: "For leadership and the board",
    blurb: "Premium gifts chosen for the person, not the title. Delivered with care.",
    inside: ["Premium gift matched to the person", "Handwritten note", "White-glove delivery", "Discreet gift planning"],
    brand: ["Subtle, premium branding", "Signed by the chairman or team"],
    plan: "Signature",
    occasion: "Executives",
  },
  {
    icon: Handshake,
    title: "Clients & business partners",
    when: "Deal wins, anniversaries, festive season",
    who: "For the people who grow your business",
    blurb: "Keep relationships warm all year. Branded hampers with your MD’s note.",
    inside: ["Branded hampers", "Deal-close and anniversary gifts", "Festive season gifting list"],
    brand: ["Your logo on box, ribbon and card", "Note from your MD"],
    plan: "Signature",
    occasion: "Business partners",
  },
  {
    icon: PartyPopper,
    title: "Team hangouts",
    when: "Offsites, wins, Friday treats",
    who: "For teams that deserve a moment",
    blurb: "Turn a hangout into an event. Custom cakes and branded packs, delivered to the venue.",
    inside: ["Custom celebration cake", "Snack and drink packs", "Delivered to office or venue"],
    brand: ["Logo or campaign on the cake", "Branded pack sleeves"],
    plan: "Seasons",
    occasion: "Team hangout",
  },
  {
    icon: Gift,
    title: "End-of-year packages",
    when: "December · the big one",
    who: "For every staff member",
    blurb: "The gift your staff talk about in January. Branded hampers at scale, across every office.",
    inside: ["Branded hamper or package", "Option to swap for a gift card", "Multi-office delivery", "One delivery report"],
    brand: ["Full custom packaging", "Card signed by leadership"],
    plan: "Seasons",
    occasion: "End of year",
  },
  {
    icon: Award,
    title: "Welcome, promotions & farewells",
    when: "All year",
    who: "For every career moment",
    blurb: "Start well, celebrate growth, send people off properly.",
    inside: ["Onboarding welcome kits", "Promotion and long-service gifts", "Farewell and retirement gifts"],
    brand: ["Branded welcome box", "Custom message per moment"],
    plan: "Pulse",
    occasion: "Team birthdays",
  },
];

export interface Plan {
  icon: LucideIcon;
  name: PlanName;
  audience: string;
  price: string;
  perks: string[];
  cta: string;
  featured?: string;
  occasions: BusinessOccasion[];
}

export const PLANS: Plan[] = [
  {
    icon: Cake,
    name: "Pulse",
    audience: "Team birthdays & milestones, on autopilot",
    price: "Per staff, billed monthly · [set price]",
    perks: [
      "Branded cake or cake pack on every birthday",
      "Work anniversaries, promotions, new babies",
      "HR dashboard with upcoming dates",
      "Delivery photo for every gift",
    ],
    cta: "Start Pulse",
    occasions: ["Team birthdays"],
  },
  {
    icon: Sparkles,
    name: "Seasons",
    audience: "Big moments for the whole company",
    price: "Per campaign · [set price]",
    perks: [
      "Customer Service Week, Father’s & Mother’s Day",
      "End-of-year packages and hampers",
      "Branded packaging designed with you",
      "Delivery across your offices",
    ],
    cta: "Plan a campaign",
    featured: "For campaigns",
    occasions: [],
  },
  {
    icon: Crown,
    name: "Signature",
    audience: "MDs, CEOs, directors and business partners",
    price: "Custom · by request",
    perks: [
      "Premium gifts matched to the person",
      "Handwritten notes, white-glove delivery",
      "A dedicated gifting manager",
      "Client and partner gifting calendar",
    ],
    cta: "Request Signature",
    occasions: ["Executives"],
  },
];

export const GIFT_CARD_VALUES = [10000, 25000, 50000, 100000];
export const GIFT_CARD_MAX_QUANTITY = 5000;

export const PLANNER_CHOICES: { value: PlannerOccasion; label: string; checked: boolean }[] = [
  { value: "bday", label: "Birthdays", checked: true },
  { value: "csw", label: "Customer Service Week", checked: true },
  { value: "parents", label: "Father’s & Mother’s Day", checked: false },
  { value: "eoy", label: "End of year", checked: true },
  { value: "hangout", label: "Team hangouts", checked: false },
];

export interface CalendarEvent {
  icon: LucideIcon;
  title: string;
  detail: string;
  date: string;
}

export const CALENDAR: { month: string; events: CalendarEvent[] }[] = [
  {
    month: "Jan",
    events: [
      { icon: Sunrise, title: "New-year resumption", detail: "Welcome-back packs for the team", date: "Early Jan" },
      { icon: PartyPopper, title: "Team kick-off", detail: "Cakes and packs for planning days", date: "Jan" },
    ],
  },
  {
    month: "Feb",
    events: [
      { icon: Heart, title: "Val’s Day at work", detail: "Small treats for every desk", date: "14 Feb" },
      { icon: Handshake, title: "Client appreciation", detail: "Start the year warm with partners", date: "Feb" },
    ],
  },
  {
    month: "Mar",
    events: [
      { icon: Flower2, title: "International Women’s Day", detail: "Gifts for the women on your team", date: "8 Mar" },
      { icon: HeartHandshake, title: "Mothering Sunday", detail: "For the mothers on staff", date: "Mar/Apr" },
    ],
  },
  {
    month: "Apr",
    events: [
      { icon: Egg, title: "Easter", detail: "Hampers for staff and partners", date: "Mar/Apr" },
      { icon: ClipboardCheck, title: "Admin Professionals’ Day", detail: "Thank your assistants and admin team", date: "Late Apr" },
    ],
  },
  {
    month: "May",
    events: [
      { icon: HardHat, title: "Workers’ Day", detail: "Recognise the whole workforce", date: "1 May" },
      { icon: Baby, title: "Children’s Day", detail: "Treats for staff kids", date: "27 May" },
    ],
  },
  {
    month: "Jun",
    events: [
      { icon: HeartHandshake, title: "Father’s Day", detail: "For the fathers on staff", date: "3rd Sun of June" },
      { icon: Flag, title: "Democracy Day", detail: "A thoughtful long-weekend treat", date: "12 Jun" },
      { icon: Trophy, title: "Half-year wins", detail: "Celebrate the H1 numbers", date: "Late Jun" },
    ],
  },
  {
    month: "Jul",
    events: [
      { icon: TrendingUp, title: "Promotions season", detail: "Gifts for mid-year promotions", date: "Jul" },
      { icon: PartyPopper, title: "Team hangouts", detail: "Cakes and packs for offsites", date: "Jul" },
    ],
  },
  {
    month: "Aug",
    events: [
      { icon: Award, title: "Long-service awards", detail: "Milestone gifts for loyal staff", date: "Aug" },
      { icon: Plane, title: "Farewells", detail: "Send-offs done properly", date: "Aug" },
    ],
  },
  {
    month: "Sep",
    events: [
      { icon: Handshake, title: "Partner check-ins", detail: "Q3 gifts for key clients", date: "Sep" },
      { icon: ClipboardList, title: "Plan Q4", detail: "Lock in CSW and end-of-year early", date: "Sep" },
    ],
  },
  {
    month: "Oct",
    events: [
      { icon: Headset, title: "Customer Service Week", detail: "A full week for your front-liners", date: "1st full week" },
      { icon: Flag, title: "Independence Day", detail: "Green-white-green treats", date: "1 Oct" },
      { icon: Crown, title: "Boss’s Day", detail: "Something for your MD or directors", date: "16 Oct" },
    ],
  },
  {
    month: "Nov",
    events: [
      { icon: Package, title: "Book end-of-year", detail: "Branded packaging needs lead time", date: "Nov" },
      { icon: Handshake, title: "Partner gift list", detail: "Confirm who gets what", date: "Nov" },
    ],
  },
  {
    month: "Dec",
    events: [
      { icon: Gift, title: "End-of-year packages", detail: "The gift staff remember in January", date: "Dec" },
      { icon: Sparkles, title: "Christmas & Detty December", detail: "Hampers for staff and partners", date: "Dec" },
    ],
  },
];

export const BUSINESS_FAQ = [
  { q: "Is there a minimum order?", a: "[Confirm minimum order for branded cakes and packs.]" },
  {
    q: "How early should we book?",
    a: "[Confirm lead time for branded items.] For big campaigns like Customer Service Week, talk to us a month ahead.",
  },
  {
    q: "What do you need for branding?",
    a: "Your logo (PNG or SVG), brand colours and the message. We send mockups for approval before anything is made.",
  },
  {
    q: "Can you deliver to several offices?",
    a: "Yes. [Confirm cities covered.] You get one delivery report for all locations.",
  },
  { q: "How do we pay?", a: "One invoice per month or per campaign. [Confirm payment terms.]" },
  {
    q: "Can staff choose their own gift?",
    a: "Yes — send branded gift cards, or let each person share a Givftme wishlist.",
  },
];
