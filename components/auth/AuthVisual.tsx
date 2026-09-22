import Image from "next/image";
import Link from "next/link";
import { Camera, MessageCircle, Users } from "lucide-react";

export function AuthVisual({ mode }: { mode: "login" | "signup" }) {
  return (
    <aside className="relative h-48 bg-peach lg:col-span-4 lg:flex lg:h-auto lg:min-h-dvh lg:flex-col lg:justify-center lg:px-8 lg:py-28">
      <Link href="/" aria-label="Givftme home" className="absolute left-0 top-0 inline-flex min-h-11 items-center rounded focus-visible:outline-2 focus-visible:outline-brand lg:left-8 lg:top-4">
        <Image src="/logo.png" alt="Givftme" width={140} height={47} preload />
      </Link>
      <div className="relative mx-auto h-full w-full max-w-xl lg:h-[410px]">
        <p className="absolute right-4 top-16 z-10 w-32 rounded-2xl bg-white p-3 text-xs leading-4 text-ink shadow-soft lg:right-0 lg:top-0 lg:w-64 lg:p-4 lg:text-base lg:leading-6">
          {mode === "login"
            ? "Welcome back! Your dates are right where you left them."
            : "A little thought, a lot of love. Let’s make their day."}
        </p>
        <div className="absolute bottom-0 left-4 h-32 w-36 lg:bottom-8 lg:left-1/2 lg:h-72 lg:w-96 lg:-translate-x-1/2 lg:overflow-hidden">
          <Image src="/images/givftme-wave.png" alt="Givftme’s smiling gift mascot waving hello" width={820} height={687} sizes="(min-width: 1024px) 384px, 144px" className="h-auto w-full" preload />
        </div>
        <ul className="absolute bottom-0 left-1/2 hidden w-max max-w-full -translate-x-1/2 items-center gap-5 rounded-3xl bg-white px-6 py-4 text-xs shadow-soft lg:flex xl:text-sm">
          <li className="flex items-center gap-2"><MessageCircle aria-hidden className="size-4 shrink-0 text-brand" />WhatsApp reminders</li>
          <li className="flex items-center gap-2"><Users aria-hidden className="size-4 shrink-0 text-brand" />Gift with friends</li>
          <li className="flex items-center gap-2"><Camera aria-hidden className="size-4 shrink-0 text-brand" />Delivery photo</li>
        </ul>
      </div>
      <p className="absolute bottom-8 left-12 hidden font-display text-2xl text-brand lg:block">Because love has a deadline.</p>
    </aside>
  );
}
