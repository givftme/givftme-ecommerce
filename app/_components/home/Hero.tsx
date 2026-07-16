"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/Button";

const slides = [
  { src: "/images/hero-carousel-image-01.png", alt: "A family celebrating a shared meal together" },
  { src: "/images/hero-carousel-image-02.png", alt: "A family embracing warmly in their kitchen" },
];

export function Hero() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative h-[420px] w-full overflow-hidden sm:h-[480px] lg:h-[540px]">
      {slides.map((slide, index) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          priority={index === 0}
          className={cn(
            "object-cover transition-opacity duration-1000",
            index === activeIndex ? "opacity-100" : "opacity-0"
          )}
        />
      ))}
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 flex h-full max-w-7xl flex-col justify-center gap-4 px-6 mx-auto lg:px-8">
        <h1 className="max-w-xl text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
          <span className="text-brand">Simplifying</span> Givft-Giving
          <br />
          for All occasions
        </h1>
        <p className="max-w-md text-white/90">
          For Birthdays, Weddings, Anniversaries, and Festivals
        </p>
        <div>
          <Link
            href="/shop"
            className={cn(buttonVariants({ variant: "filled", size: "lg" }), "mt-2")}
          >
            Shop Now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Show slide ${index + 1}`}
            onClick={() => setActiveIndex(index)}
            className={cn(
              "h-2 rounded-full transition-all",
              index === activeIndex ? "w-6 bg-white" : "w-2 bg-white/50"
            )}
          />
        ))}
      </div>
    </section>
  );
}
