import Image from "next/image";
import { cx } from "@/components/ui/primitives";
import { LOGO } from "@/app/business/_components/content";

const { crop } = LOGO;

/**
 * The Givftme logo cropped to its artwork, `height` px tall, on a white plate
 * so the dark wordmark reads on brand colours and in dark mode.
 */
export function LogoMark({ height, className }: { height: number; className?: string }) {
  return (
    <span className={cx("inline-flex rounded-lg bg-white", className)} style={{ padding: height * 0.3 }}>
      <span
        className="relative block overflow-hidden"
        style={{ height, aspectRatio: `${crop.w} / ${crop.h}` }}
      >
        <Image
          src={LOGO.src}
          alt="Givftme"
          width={LOGO.width}
          height={LOGO.height}
          className="absolute h-auto max-w-none"
          style={{
            width: `${(LOGO.width / crop.w) * 100}%`,
            left: `${(-crop.x / crop.w) * 100}%`,
            top: `${(-crop.y / crop.h) * 100}%`,
          }}
        />
      </span>
    </span>
  );
}
