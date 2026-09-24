import { Plus } from "lucide-react";
import { Icon, Reveal, SectionHead, Wrap } from "@/components/ui/primitives";

interface Question {
  q: string;
  a: string;
}

const QUESTIONS: Question[] = [
  {
    q: "Do friends need an account to chip in?",
    a: "No. Anyone with the link can give as a guest.",
  },
  {
    q: "What if I miss a date?",
    a: "Late is survivable. We’ll help you send something the same day.",
  },
  {
    q: "Will you spam me?",
    a: "Never more than three reminders per occasion.",
  },
  {
    q: "Can I add gifts from other stores?",
    a: "Yes. Paste any link into your wishlist.",
  },
  {
    q: "Where do you deliver?",
    a: "[Confirm delivery areas and same-day coverage.]",
  },
  {
    q: "What about sad occasions?",
    a: "For condolences, we go quiet. No confetti. Just a careful way to send something.",
  },
];

export default function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="pb-24 max-sm:pb-16">
      <Wrap>
        <Reveal>
          <SectionHead center className="mb-11 max-sm:mb-7">
            <h2 id="faq-heading" className="text-[clamp(32px,4.4vw,54px)]">
              Quick answers
            </h2>
          </SectionHead>
        </Reveal>

        <Reveal className="mx-auto max-w-195">
          {QUESTIONS.map(({ q, a }) => (
            // A shared `name` makes these an exclusive accordion natively, with
            // no state and no client component.
            <details key={q} name="faq" className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
                <h3 className="text-base font-medium">{q}</h3>
                <Icon
                  as={Plus}
                  className="text-red transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="max-w-[40em] pb-5 text-[14.5px] text-muted">{a}</p>
            </details>
          ))}
        </Reveal>
      </Wrap>
    </section>
  );
}
