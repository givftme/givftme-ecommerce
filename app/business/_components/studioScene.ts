import type * as Three from "three";
import { inkFor, isLight, shade } from "@/app/business/_components/color";
import { LOGO } from "@/app/business/_components/content";

export type StudioProduct = "cake" | "box" | "card";

export interface StudioDesign {
  name: string;
  message: string;
  color: string;
  logo: HTMLImageElement | null;
  /** The gift card face value, already formatted. */
  cardAmount: string;
}

export interface Studio {
  paint: (design: StudioDesign) => void;
  setProduct: (product: StudioProduct) => void;
  setOpen: (open: boolean) => void;
  /** A PNG data URL of the current frame. */
  snapshot: () => string;
  dispose: () => void;
}

interface StudioOptions {
  stage: HTMLDivElement;
  holder: HTMLSpanElement;
  reduce: boolean;
  design: StudioDesign;
  product: StudioProduct;
}

/** See HeroStage: r155+ physically correct lighting renders about PI times darker. */
const LIGHT = Math.PI;

const ease = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

/** next/font hashes family names, so canvas text reads them from the root CSS variables. */
function fontFamily(variable: string, fallback: string) {
  const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return family ? `${family}, ${fallback}` : fallback;
}

/**
 * Builds the brand studio scene (cake pack, gift box, gift card) and starts its
 * loop. Returns null when WebGL refuses a context. Kept out of the component so
 * `three` is code-split away from the first paint.
 */
export function createStudio(
  THREE: typeof Three,
  { stage, holder, reduce, design: initialDesign, product }: StudioOptions,
): Studio | null {
  const canvas = document.createElement("canvas");
  canvas.className = "block size-full cursor-grab touch-pan-y";
  canvas.setAttribute("aria-hidden", "true");
  holder.appendChild(canvas);

  let renderer: Three.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      // Keeps the last frame readable for the Save button.
      preserveDrawingBuffer: true,
    });
  } catch {
    canvas.remove();
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffd8c4, 0.85 * LIGHT));
  const key = new THREE.DirectionalLight(0xffffff, 0.75 * LIGHT);
  key.position.set(4, 7, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffc8a0, 0.35 * LIGHT);
  fill.position.set(-5, 2, -3);
  scene.add(fill);
  const root = new THREE.Group();
  scene.add(root);

  // Painted faces.
  const makeTexture = (w: number, h: number) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { ctx: c.getContext("2d")!, texture, w, h };
  };
  const lidTop = makeTexture(512, 512);
  const packFront = makeTexture(1024, 512);
  const boxFront = makeTexture(512, 512);
  const cardFront = makeTexture(1024, 640);
  const cardBack = makeTexture(1024, 640);
  const textures = [lidTop, packFront, boxFront, cardFront, cardBack];

  const standard = (color: number, roughness: number, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mats = {
    body: standard(0x1b2b5e, 0.5),
    lid: standard(0x1b2b5e, 0.45),
    ribbon: standard(0xffffff, 0.35, 0.05),
    cardEdge: standard(0x1b2b5e, 0.4),
    cream: standard(0xfff3e3, 0.7),
    cakeTop: standard(0x1b2b5e, 0.55),
    candle: standard(0xffb020, 0.4),
    boxInside: standard(0xfff3e3, 0.6),
    flame: new THREE.MeshBasicMaterial({ color: 0xff8a1f }),
    lidTop: new THREE.MeshStandardMaterial({ map: lidTop.texture, roughness: 0.5 }),
    packFront: new THREE.MeshStandardMaterial({ map: packFront.texture, roughness: 0.5 }),
    boxFront: new THREE.MeshStandardMaterial({ map: boxFront.texture, roughness: 0.5 }),
    cardFront: new THREE.MeshStandardMaterial({ map: cardFront.texture, roughness: 0.35, metalness: 0.05 }),
    cardBack: new THREE.MeshStandardMaterial({ map: cardBack.texture, roughness: 0.5 }),
  };

  // Cake pack. BoxGeometry faces run +x, -x, +y, -y, +z, -z.
  const cake = new THREE.Group();
  root.add(cake);
  const packBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 2.6), [
    mats.body, mats.body, mats.body, mats.body, mats.packFront, mats.body,
  ]);
  packBody.position.y = -0.1;
  cake.add(packBody);
  const packLid = new THREE.Group();
  packLid.position.set(0, 0.55, -1.3);
  cake.add(packLid);
  const packLidMesh = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.18, 2.7), [
    mats.lid, mats.lid, mats.lidTop, mats.lid, mats.lid, mats.lid,
  ]);
  packLidMesh.position.set(0, 0.09, 1.3);
  packLid.add(packLidMesh);
  const cakeInside = new THREE.Group();
  cakeInside.position.y = -0.05;
  cakeInside.visible = false;
  cake.add(cakeInside);
  cakeInside.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.8, 48), mats.cream));
  const icing = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.14, 48), mats.cakeTop);
  icing.position.y = 0.44;
  cakeInside.add(icing);
  const candleG = new THREE.CylinderGeometry(0.04, 0.04, 0.34, 10);
  const flameG = new THREE.SphereGeometry(0.05, 10, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const candle = new THREE.Mesh(candleG, mats.candle);
    candle.position.set(Math.cos(a) * 0.55, 0.68, Math.sin(a) * 0.55);
    cakeInside.add(candle);
    const flame = new THREE.Mesh(flameG, mats.flame);
    flame.scale.y = 1.6;
    flame.position.set(Math.cos(a) * 0.55, 0.9, Math.sin(a) * 0.55);
    cakeInside.add(flame);
  }

  // Gift box.
  const box = new THREE.Group();
  root.add(box);
  box.add(
    new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), [
      mats.body, mats.body, mats.body, mats.body, mats.boxFront, mats.body,
    ]),
  );
  box.add(new THREE.Mesh(new THREE.BoxGeometry(2.03, 2.02, 0.3), mats.ribbon));
  const boxLid = new THREE.Group();
  boxLid.position.y = 1;
  box.add(boxLid);
  const boxLidMesh = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.4, 2.16), mats.lid);
  boxLidMesh.position.y = 0.2;
  boxLid.add(boxLidMesh);
  const lidRibbonX = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 2.18), mats.ribbon);
  lidRibbonX.position.y = 0.2;
  boxLid.add(lidRibbonX);
  const lidRibbonZ = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.42, 0.32), mats.ribbon);
  lidRibbonZ.position.y = 0.2;
  boxLid.add(lidRibbonZ);
  const loopG = new THREE.TorusGeometry(0.3, 0.1, 14, 36);
  const loopL = new THREE.Mesh(loopG, mats.ribbon);
  loopL.position.set(-0.3, 0.66, 0);
  loopL.rotation.set(0, 0.35, 0.55);
  boxLid.add(loopL);
  const loopR = new THREE.Mesh(loopG, mats.ribbon);
  loopR.position.set(0.3, 0.66, 0);
  loopR.rotation.set(0, -0.35, -0.55);
  boxLid.add(loopR);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), mats.ribbon);
  knot.position.y = 0.48;
  boxLid.add(knot);
  const boxInside = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.8), mats.boxInside);
  boxInside.position.y = 0.7;
  boxInside.visible = false;
  box.add(boxInside);

  // Gift card.
  const card = new THREE.Group();
  root.add(card);
  card.add(
    new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.12, 0.05), [
      mats.cardEdge, mats.cardEdge, mats.cardEdge, mats.cardEdge, mats.cardFront, mats.cardBack,
    ]),
  );

  const groups: Record<StudioProduct, Three.Group> = { cake, box, card };
  let current = product;
  let previous: StudioProduct | null = null;
  let swapT = 1;

  let disposed = false;

  // Texture painting.
  let design = initialDesign;
  let fonts: { display: string; body: string } | null = null;

  const fitText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    size: number,
    font: (size: number) => string,
  ) => {
    let s = size;
    ctx.font = font(s);
    while (ctx.measureText(text).width > maxWidth && s > 14) {
      s -= 2;
      ctx.font = font(s);
    }
  };

  const drawLogo = (ctx: CanvasRenderingContext2D, cx: number, cy: number, maxW: number, maxH: number) => {
    const logo = design.logo;
    if (!logo) return false;
    const r = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * r;
    const h = logo.height * r;
    ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
    return true;
  };

  // Our own logo, painted onto the mockups once it has loaded.
  const givftmeLogo = new Image();
  givftmeLogo.onload = () => {
    if (!disposed) paint(design);
  };
  givftmeLogo.src = LOGO.src;

  /** The white plate that carries our logo at a given logo height. */
  const markSize = (logoHeight: number) => {
    const pad = logoHeight * 0.3;
    return { w: logoHeight * (LOGO.crop.w / LOGO.crop.h) + pad * 2, h: logoHeight + pad * 2, pad };
  };

  /** Our logo, cropped to its artwork, on a white plate with its top-left at (x, y). */
  const drawMark = (ctx: CanvasRenderingContext2D, x: number, y: number, logoHeight: number) => {
    if (!givftmeLogo.complete || !givftmeLogo.naturalWidth) return;
    const { w, h, pad } = markSize(logoHeight);
    const { crop } = LOGO;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, pad);
    ctx.fill();
    ctx.drawImage(givftmeLogo, crop.x, crop.y, crop.w, crop.h, x + pad, y + pad, w - pad * 2, logoHeight);
    ctx.restore();
  };

  const paint = (next: StudioDesign) => {
    design = next;
    fonts ??= {
      display: fontFamily("--font-belleza-src", "sans-serif"),
      body: fontFamily("--font-inter", "sans-serif"),
    };
    const display = (s: number) => `${s}px ${fonts!.display}`;
    const body = (s: number) => `500 ${s}px ${fonts!.body}`;
    const { color, name, message } = design;
    const ink = inkFor(color);

    // Cake pack lid.
    let { ctx, w: W, h: H } = lidTop;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 6;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (drawLogo(ctx, W / 2, 200, 300, 170)) {
      fitText(ctx, name, 420, 54, display);
      ctx.fillText(name, W / 2, 350);
    } else {
      fitText(ctx, name, 420, 78, display);
      ctx.fillText(name, W / 2, 240);
    }
    ctx.globalAlpha = 0.7;
    ctx.font = body(18);
    ctx.fillText("gifted with", W / 2, 410);
    ctx.globalAlpha = 1;
    const lidMark = markSize(30);
    drawMark(ctx, W / 2 - lidMark.w / 2, 428, 30);
    lidTop.texture.needsUpdate = true;

    // Cake pack front band.
    ({ ctx, w: W, h: H } = packFront);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = shade(color, isLight(color) ? -0.12 : 0.14);
    ctx.fillRect(0, H * 0.62, W, H * 0.38);
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitText(ctx, message, 900, 104, display);
    ctx.fillText(message, W / 2, H * 0.34);
    const from = `with love from ${name}`;
    ctx.globalAlpha = 0.85;
    fitText(ctx, from, 860, 40, body);
    ctx.fillText(from, W / 2, H * 0.8);
    ctx.globalAlpha = 1;
    packFront.texture.needsUpdate = true;

    // Gift box front.
    ({ ctx, w: W, h: H } = boxFront);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = isLight(color) ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.1)";
    ctx.beginPath();
    ctx.arc(W / 2, H / 2 - 20, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (drawLogo(ctx, W / 2, H / 2 - 40, 200, 120)) {
      fitText(ctx, name, 300, 36, display);
      ctx.fillText(name, W / 2, H / 2 + 60);
    } else {
      fitText(ctx, name, 280, 56, display);
      ctx.fillText(name, W / 2, H / 2 - 20);
    }
    ctx.globalAlpha = 0.8;
    fitText(ctx, message, 420, 26, body);
    ctx.fillText(message, W / 2, H - 80);
    ctx.globalAlpha = 1;
    boxFront.texture.needsUpdate = true;

    // Gift card front.
    ({ ctx, w: W, h: H } = cardFront);
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, shade(color, -0.35));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 90;
    ctx.beginPath();
    ctx.arc(W - 40, 40, 230, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = inkFor(shade(color, -0.17));
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    if (drawLogo(ctx, 150, 120, 200, 110)) {
      fitText(ctx, name, 560, 48, display);
      ctx.fillText(name, 70, 250);
    } else {
      fitText(ctx, name, 640, 64, display);
      ctx.fillText(name, 70, 130);
    }
    ctx.globalAlpha = 0.8;
    ctx.font = body(26);
    ctx.fillText("GIFT CARD", 70, H - 170);
    ctx.globalAlpha = 1;
    ctx.font = display(110);
    ctx.fillText(design.cardAmount, 64, H - 60);
    const cardMark = markSize(44);
    drawMark(ctx, W - 60 - cardMark.w, H - 56 - cardMark.h, 44);
    cardFront.texture.needsUpdate = true;

    // Gift card back.
    ({ ctx, w: W, h: H } = cardBack);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color;
    ctx.fillRect(0, 70, W, 90);
    // Logo plate centred on the brand stripe.
    const backMark = markSize(40);
    drawMark(ctx, W - 70 - backMark.w, 115 - backMark.h / 2, 40);
    ctx.fillStyle = "#16161a";
    ctx.textAlign = "left";
    ctx.font = `600 30px ${fonts.body}`;
    ctx.fillText("Redeem on Givftme", 70, 260);
    ctx.font = `400 24px ${fonts.body}`;
    ctx.fillStyle = "#62626e";
    ctx.fillText("Open the link we sent. Pick your gift.", 70, 310);
    ctx.fillText("Code: GVT-XXXX-XXXX", 70, H - 70);
    cardBack.texture.needsUpdate = true;

    mats.body.color.set(color);
    mats.lid.color.set(shade(color, -0.08));
    mats.cardEdge.color.set(color);
    mats.cakeTop.color.set(color);
    // An amber ribbon on red, otherwise whichever of white or ink reads on the box.
    mats.ribbon.color.set(
      color.toLowerCase() === "#e11d2e" ? 0xffb020 : isLight(color) ? 0x16161a : 0xffffff,
    );
  };

  paint(design);
  // Canvas text falls back silently until the web fonts arrive, so repaint then.
  document.fonts?.ready.then(() => {
    if (!disposed) paint(design);
  });

  // Sizing.
  const size = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.set(0, 2.4, w < 520 ? 12.5 : 10.5);
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
  };
  size();
  const resizeObserver = new ResizeObserver(size);
  resizeObserver.observe(stage);

  // Drag to turn.
  let rotY = -0.5;
  let rotX = 0.08;
  let velY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let idle = 0;
  const onPointerDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = "grabbing";
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    velY = dx * 0.012;
    rotY += velY;
    rotX = Math.max(-0.25, Math.min(0.5, rotX + dy * 0.006));
    idle = 0;
  };
  const onPointerUp = () => {
    dragging = false;
    canvas.style.cursor = "";
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  // Loop.
  const start = performance.now();
  const elapsed = () => (performance.now() - start) / 1000;
  let isOpen = false;
  let openAt = -10;
  let running = true;
  let raf: number | null = null;
  let prev = 0;

  const tick = () => {
    raf = null;
    if (!running || document.hidden) return;
    const t = elapsed();
    const dt = Math.min(t - prev, 0.05);
    prev = t;
    idle += dt;

    if (!dragging) {
      velY *= 0.92;
      rotY += velY;
      if (idle > 2 && !reduce) rotY += dt * 0.35;
    }
    root.rotation.y = rotY;
    root.rotation.x = rotX;

    // Product swap: the new one grows in while the old one shrinks away.
    swapT = Math.min(1, swapT + dt * 2.4);
    (Object.keys(groups) as StudioProduct[]).forEach((k) => {
      const g = groups[k];
      if (k === current) {
        g.visible = true;
        g.scale.setScalar(0.6 + 0.4 * ease(swapT));
      } else if (k === previous && swapT < 0.5) {
        g.visible = true;
        g.scale.setScalar(1 - swapT * 1.6);
      } else {
        g.visible = false;
      }
    });

    const bob = reduce ? 0 : Math.sin(t * 1.8) * 0.06;
    cake.position.y = bob;
    box.position.y = bob + 0.1;
    card.position.y = 0.35 + bob * 1.5;
    card.rotation.z = reduce ? 0 : Math.sin(t * 1.1) * 0.04;

    const p = ease((t - openAt) / 0.6);
    const o = openAt < 0 ? 0 : isOpen ? p : 1 - p;
    packLid.rotation.x = -o * 1.9;
    packLid.position.y = 0.55 + o * 0.05;
    cakeInside.visible = o > 0.05;
    boxLid.position.y = 1 + o * 1.3;
    boxLid.rotation.x = -o * 0.5;
    boxLid.rotation.y = o * 0.6;
    boxInside.visible = o > 0.05;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };

  const loop = () => {
    if (raf || disposed) return;
    prev = elapsed();
    raf = requestAnimationFrame(tick);
  };

  // Only burn frames while the stage is on screen and the tab is visible.
  const visibility = new IntersectionObserver(([entry]) => {
    running = entry.isIntersecting;
    if (running) loop();
  });
  visibility.observe(stage);
  const onVisibility = () => {
    if (!document.hidden && running) loop();
  };
  document.addEventListener("visibilitychange", onVisibility);
  loop();

  return {
    paint,
    setProduct(next) {
      if (next === current) return;
      previous = current;
      current = next;
      swapT = 0;
      isOpen = false;
      openAt = -10;
    },
    setOpen(open) {
      isOpen = open;
      openAt = elapsed();
      if (open) rotX = 0.35;
    },
    snapshot() {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    },
    dispose() {
      disposed = true;
      running = false;
      if (raf) cancelAnimationFrame(raf);
      visibility.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
      Object.values(mats).forEach((m) => m.dispose());
      textures.forEach(({ texture }) => texture.dispose());
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
}
