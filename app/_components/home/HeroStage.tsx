"use client"

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import type * as Three from "three";
import { CalendarHeart, Users } from "lucide-react";
import { useReducedMotion } from "@/hooks/useMediaQuery";
import { Icon, SmartImage, cx } from "@/components/ui/primitives";

const MESSAGES = [
  "It’s with her.",
  "Happy 30th, Chidi!",
  "Tunde has no idea.",
  "Love, on time.",
];

/**
 * three.js dropped the legacy lighting mode in r155: the same intensity now
 * renders about PI times darker. Scaling by PI keeps the mascot lit the way
 * the original r128 scene was.
 */
const LIGHT = Math.PI;

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * Builds the whole scene and starts its loop. Returns the teardown, or null
 * when WebGL refuses a context. Kept out of the component so `three` can be
 * code-split away from the first paint.
 */
interface Bubble {
  text: string;
  show: boolean;
}

interface MascotOptions {
  stage: HTMLDivElement;
  holder: HTMLSpanElement;
  shadow: HTMLDivElement | null;
  reduce: boolean;
  setBubble: Dispatch<SetStateAction<Bubble>>;
}

interface Mascot {
  open: () => void;
  dispose: () => void;
}

function createMascot(
  THREE: typeof Three,
  { stage, holder, shadow, reduce, setBubble }: MascotOptions,
): Mascot | null {
  // A fresh canvas per mount, so a remount never fights over the WebGL context.
  const canvas = document.createElement("canvas");
  canvas.className = "block h-full w-full";
  holder.appendChild(canvas);

  let renderer: Three.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
  } catch {
    canvas.remove();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd2b8, 0.9 * LIGHT));
  const key = new THREE.DirectionalLight(0xffffff, 0.8 * LIGHT);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffa060, 0.55 * LIGHT);
  rim.position.set(-6, 3, -4);
  scene.add(rim);

  const standard = (color: number, roughness: number, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });

  const red = standard(0xe11d2e, 0.42);
  const redLid = standard(0xcf1628, 0.4);
  const ribbon = standard(0xff8a1f, 0.32, 0.08);
  const gold = standard(0xffb020, 0.3, 0.15);
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const dark = new THREE.MeshBasicMaterial({ color: 0x1b1116 });
  const cheekM = new THREE.MeshBasicMaterial({
    color: 0xff9aa5,
    transparent: true,
    opacity: 0.75,
  });

  const root = new THREE.Group();
  scene.add(root);
  const mascot = new THREE.Group();
  root.add(mascot);

  // Body and its ribbon cross.
  const body = new THREE.Group();
  mascot.add(body);
  body.add(new THREE.Mesh(new THREE.BoxGeometry(2, 1.7, 2), red));
  body.add(new THREE.Mesh(new THREE.BoxGeometry(2.03, 1.72, 0.34), ribbon));
  const backRib = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 1.72, 0.06),
    ribbon,
  );
  backRib.position.z = -1;
  body.add(backRib);

  // Face.
  const face = new THREE.Group();
  face.position.z = 1.006;
  body.add(face);
  const eyes: Three.Group[] = [];
  const pupils: Three.Mesh[] = [];
  [-0.46, 0.46].forEach((x) => {
    const eye = new THREE.Group();
    eye.position.set(x, 0.2, 0);
    eye.add(new THREE.Mesh(new THREE.CircleGeometry(0.22, 40), white));
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), dark);
    pupil.position.z = 0.004;
    eye.add(pupil);
    const glint = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), white);
    glint.position.set(0.04, 0.05, 0.004);
    pupil.add(glint);
    face.add(eye);
    eyes.push(eye);
    pupils.push(pupil);
  });
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.038, 10, 32, Math.PI),
    dark,
  );
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.2, 0.01);
  face.add(smile);
  const ooh = new THREE.Mesh(new THREE.CircleGeometry(0.1, 28), dark);
  ooh.position.set(0, -0.28, 0.01);
  ooh.visible = false;
  face.add(ooh);
  [-0.78, 0.78].forEach((x) => {
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.13, 28), cheekM);
    cheek.position.set(x, -0.12, 0.002);
    face.add(cheek);
  });

  // Lid and bow.
  const lid = new THREE.Group();
  lid.position.y = 0.85;
  mascot.add(lid);
  const lidBox = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.44, 2.2), redLid);
  lidBox.position.y = 0.22;
  lid.add(lidBox);
  const lidRibX = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.46, 2.22),
    ribbon,
  );
  lidRibX.position.y = 0.22;
  lid.add(lidRibX);
  const lidRibZ = new THREE.Mesh(
    new THREE.BoxGeometry(2.22, 0.46, 0.36),
    ribbon,
  );
  lidRibZ.position.y = 0.22;
  lid.add(lidRibZ);

  const bow = new THREE.Group();
  bow.position.y = 0.5;
  lid.add(bow);
  const loopG = new THREE.TorusGeometry(0.33, 0.11, 16, 40);
  const loopL = new THREE.Mesh(loopG, ribbon);
  loopL.position.set(-0.34, 0.24, 0);
  loopL.rotation.set(0, 0.35, 0.55);
  bow.add(loopL);
  const loopR = new THREE.Mesh(loopG, ribbon);
  loopR.position.set(0.34, 0.24, 0);
  loopR.rotation.set(0, -0.35, -0.55);
  bow.add(loopR);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), gold);
  knot.position.y = 0.08;
  bow.add(knot);

  // Confetti that erupts out of the box.
  const bitG = new THREE.PlaneGeometry(0.12, 0.2);
  const bitCols = [0xe11d2e, 0xff7a1a, 0xffb020, 0xffd6da, 0xffffff];
  const bitMats = bitCols.map(
    (color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  );
  const bits: Three.Mesh[] = [];
  for (let i = 0; i < 80; i++) {
    const bit = new THREE.Mesh(bitG, bitMats[i % bitMats.length]);
    bit.visible = false;
    bit.userData = {
      v: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      born: 0,
    };
    root.add(bit);
    bits.push(bit);
  }

  const size = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 1.6, w < 520 ? 12 : 10);
    camera.lookAt(0, 0.45, 0);
    camera.updateProjectionMatrix();
  };
  size();

  let resizeObserver: ResizeObserver | undefined;
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(size);
    resizeObserver.observe(stage);
  } else {
    window.addEventListener("resize", size);
  }

  const ptr = { x: 0, y: 0 };
  const cur = { x: 0, y: 0 };
  const onPointerMove = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    ptr.x = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 1.2));
    ptr.y = clamp(-(e.clientY - (r.top + r.height / 2)) / (r.height / 1.2));
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  const clock = new THREE.Clock();
  let messageIndex = 0;
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
  let openAt = -10;
  let nextBlink = 2;
  let blinkAt = -10;
  let spin = 0;
  let prev = 0;

  const open = () => {
    const t = clock.getElapsedTime();
    if (t - openAt < 2.1) return;
    openAt = t;
    spin = 7;
    bits.forEach((bit) => {
      bit.visible = true;
      bit.position.set(
        (Math.random() - 0.5) * 1.2,
        1.4,
        (Math.random() - 0.5) * 1.2,
      );
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 2.5;
      bit.userData.v.set(
        Math.cos(a) * sp,
        4 + Math.random() * 4,
        Math.sin(a) * sp * 0.6,
      );
      bit.userData.spin.set(
        Math.random() * 10,
        Math.random() * 10,
        Math.random() * 10,
      );
      bit.userData.born = t;
    });

    setBubble({
      text: MESSAGES[messageIndex++ % MESSAGES.length],
      show: true,
    });
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(
      () => setBubble((b) => ({ ...b, show: false })),
      1800,
    );

    if (navigator.vibrate) {
      try {
        navigator.vibrate(18);
      } catch {
        /* vibration is a nicety; ignore refusals */
      }
    }
  };

  let running = true;
  let raf: number | null = null;

  const tick = () => {
    raf = null;
    if (!running || document.hidden) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(t - prev, 0.05);
    prev = t;

    cur.x += (ptr.x - cur.x) * 0.06;
    cur.y += (ptr.y - cur.y) * 0.06;

    // Lid choreography: fly up, hover, settle back down.
    const p = t - openAt;
    let liftAmount = 0;
    let tilt = 0;
    const joy = p < 2.1;
    if (joy) {
      if (p < 0.35) {
        liftAmount = easeOut(p / 0.35) * 1.5;
        tilt = easeOut(p / 0.35) * 0.7;
      } else if (p < 1.5) {
        liftAmount = 1.5 + Math.sin((p - 0.35) * 7) * 0.05;
        tilt = 0.7;
      } else {
        const q = easeOut((p - 1.5) / 0.6);
        liftAmount = 1.5 * (1 - q);
        tilt = 0.7 * (1 - q);
      }
    }

    const bob = reduce ? 0 : Math.sin(t * 2.1) * 0.12;
    const hop = joy && p < 0.5 ? Math.sin((p / 0.5) * Math.PI) * 0.45 : 0;
    mascot.position.y = bob + hop;

    const squash = reduce ? 0 : Math.sin(t * 4.2);
    body.scale.set(1 + squash * 0.012, 1 - squash * 0.018, 1);

    lid.position.y = 0.85 + liftAmount;
    lid.rotation.x = -tilt;
    spin *= 0.94;
    lid.rotation.y += spin * dt;
    if (!joy) {
      lid.rotation.y = lid.rotation.y % (Math.PI * 2);
      lid.rotation.y *= 0.88;
    }

    root.rotation.y =
      cur.x * 0.55 +
      Math.min(window.scrollY / 900, 1) * 0.9 +
      (reduce ? 0 : Math.sin(t * 0.6) * 0.08);
    root.rotation.x = -cur.y * 0.14 + 0.06;
    mascot.rotation.z = reduce ? 0 : Math.sin(t * 1.4) * 0.035;

    pupils.forEach((pupil) =>
      pupil.position.set(cur.x * 0.06, cur.y * 0.05, 0.004),
    );

    if (t > nextBlink) {
      blinkAt = t;
      nextBlink = t + 2.5 + Math.random() * 3;
    }
    let eyeScale = 1;
    const blinkP = t - blinkAt;
    if (blinkP < 0.16) {
      eyeScale = 1 - Math.sin((blinkP / 0.16) * Math.PI) * 0.92;
    }
    if (joy && p < 1.7) eyeScale = 0.3;
    eyes.forEach((eye) => (eye.scale.y = eyeScale));
    smile.visible = !(joy && p < 1.6);
    ooh.visible = joy && p < 1.6;

    for (const bit of bits) {
      if (!bit.visible) continue;
      if (t - bit.userData.born > 2.6) {
        bit.visible = false;
        continue;
      }
      bit.userData.v.y -= 8.8 * dt;
      bit.position.addScaledVector(bit.userData.v, dt);
      bit.rotation.x += bit.userData.spin.x * dt;
      bit.rotation.y += bit.userData.spin.y * dt;
    }

    const lift = bob + hop;
    if (shadow) {
      shadow.style.transform = `scale(${1 - lift * 0.35})`;
      shadow.style.opacity = String(Math.max(0.2, 1 - lift * 0.6));
    }

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  const loop = () => {
    if (raf) return;
    prev = clock.getElapsedTime();
    raf = requestAnimationFrame(tick);
  };

  // Only burn frames while the mascot is on screen and the tab is visible.
  const visibility = new IntersectionObserver(
    ([entry]) => {
      running = entry.isIntersecting;
      if (running) loop();
    },
    { threshold: 0 },
  );
  visibility.observe(stage);

  const onVisibility = () => {
    if (!document.hidden && running) loop();
  };
  document.addEventListener("visibilitychange", onVisibility);

  loop();
  const greeting = setTimeout(() => {
    if (!reduce) open();
  }, 1400);

  return {
    open,
    dispose() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(greeting);
      clearTimeout(bubbleTimer);
      visibility.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", size);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
      [red, redLid, ribbon, gold, white, dark, cheekM, ...bitMats].forEach(
        (m) => m.dispose(),
      );
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}

/**
 * The hero's gift-box mascot: it breathes, follows the pointer, blinks, and
 * pops its lid with a burst of 3D confetti when tapped. Falls back to a photo
 * when WebGL is unavailable.
 */
export default function HeroStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLSpanElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const openRef = useRef<(() => void) | null>(null);
  const reduce = useReducedMotion();

  const [fallback, setFallback] = useState(false);
  const [bubble, setBubble] = useState<Bubble>({
    text: MESSAGES[0],
    show: false,
  });

  useEffect(() => {
    const stage = stageRef.current;
    const holder = holderRef.current;
    const shadow = shadowRef.current;
    if (!stage || !holder) return;

    let mascot: Mascot | null = null;
    let cancelled = false;

    import("three")
      .then((THREE) => {
        if (cancelled) return;
        mascot = createMascot(THREE, {
          stage,
          holder,
          shadow,
          reduce,
          setBubble,
        });
        if (!mascot) {
          setFallback(true);
          return;
        }
        openRef.current = mascot.open;
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });

    return () => {
      cancelled = true;
      openRef.current = null;
      mascot?.dispose();
    };
  }, [reduce]);

  return (
    <div
      ref={stageRef}
      className="relative h-[560px] w-full max-lg:h-[480px] max-sm:h-[380px]"
    >
      <div className="absolute inset-x-[6%] top-[8%] bottom-[10%] rounded-[50%] bg-[radial-gradient(closest-side,rgba(255,122,26,0.2),rgba(225,29,46,0.08)_60%,transparent_72%)]" />

      {!fallback && (
        <>
          <div
            ref={shadowRef}
            className="pointer-events-none absolute bottom-[12%] left-1/2 -ml-[105px] h-[26px] w-[210px] rounded-[50%] bg-[radial-gradient(closest-side,rgba(22,22,26,0.22),transparent)] max-sm:bottom-[14%] max-sm:-ml-[75px] max-sm:w-[150px]"
          />
          <button
            type="button"
            aria-label="Open the Givtme gift box"
            onClick={() => openRef.current?.()}
            className="absolute inset-0 block size-full cursor-pointer border-0 bg-transparent p-0 [-webkit-tap-highlight-color:transparent]"
          >
            <span ref={holderRef} className="block size-full" />
          </button>
          <div className="pointer-events-none absolute bottom-[2%] left-1/2 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-white px-4 py-[9px] text-[13px] font-medium shadow-soft">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-brand" />
            </span>
            Tap the box
          </div>
        </>
      )}

      {fallback && (
        <div className="absolute inset-x-[4%] inset-y-[6%] overflow-hidden rounded-card-xl">
          <SmartImage
            src="https://givftme.vercel.app/_next/image?url=%2Fimages%2Fhero-carousel-image-02.png&w=1080&q=75"
            alt="A family embracing warmly in their kitchen"
            className="size-full object-cover"
          />
        </div>
      )}

      <FloatChip className="top-[14%] left-0 max-sm:top-[2%]">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-red-50 text-red max-sm:size-8 max-sm:rounded-[10px]">
          <Icon as={CalendarHeart} />
        </span>
        <span>
          <b className="block font-semibold">Mum’s 60th</b>30 days to go
        </span>
      </FloatChip>

      <FloatChip className="top-[8%] right-0 [animation-delay:-2s] max-sm:top-auto max-sm:bottom-[18%]">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-[#fff1e4] text-orange max-sm:size-8 max-sm:rounded-[10px]">
          <Icon as={Users} />
        </span>
        <span>
          <b className="block font-semibold">Pool complete</b>7 friends in
        </span>
      </FloatChip>

      <FloatChip className="right-[2%] bottom-[22%] [animation-delay:-4s] max-sm:hidden">
        <SmartImage
          src="https://cdn.sanity.io/images/spvd4gp2/production/fd6619ed68739f5077ca122eb99f07370ed591b4-1254x1254.png?w=120"
          alt=""
          className="size-[38px] shrink-0 rounded-xl object-cover"
        />
        <span>
          <b className="block font-semibold">Delivered</b>Photo from the door
        </span>
      </FloatChip>

      <div
        aria-live="polite"
        className={cx(
          "pointer-events-none absolute top-[6%] left-1/2 whitespace-nowrap rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white transition-all duration-350 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          bubble.show
            ? "translate-x-[-50%] translate-y-0 scale-100 opacity-100"
            : "translate-x-[-50%] translate-y-2.5 scale-90 opacity-0",
        )}
      >
        {bubble.text}
      </div>
    </div>
  );
}

function FloatChip({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "animate-floaty pointer-events-none absolute flex max-w-[210px] items-center gap-2.5 rounded-[18px] border border-line bg-white py-2.5 pr-3.5 pl-2.5 text-[13px] leading-tight shadow-soft",
        "max-sm:max-w-[160px] max-sm:p-2 max-sm:pr-2.5 max-sm:text-xs",
        className,
      )}
    >
      {children}
    </div>
  );
}
