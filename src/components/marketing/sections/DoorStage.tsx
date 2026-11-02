'use client';

import { useRef } from 'react';
import { gsap, useGSAP, ScrollTrigger, EASE, TRIGGER, fontsReady, refreshScroll } from '@/lib/animations';

interface Caption {
  title: string;
  sub: string;
}

interface Labels {
  eyebrow: string;
  title: string;
  captions: Caption[];
  chips: { currencies: string; languages: string; domain: string };
  scrollHint: string;
}

// Plain hex values: the SVG must not depend on CSS custom properties so it can
// double as an OG/illustration template later.
const C = {
  navy: '#142D36',
  navyDeep: '#0E2129',
  teal: '#15B8A6',
  tealDeep: '#0F9484',
  ivory: '#F7F4EC',
  ivory2: '#EFEAE0',
  amber: '#F4B544',
  white: '#FFFFFF',
} as const;

// Door opening in SVG units (viewBox 1200 x 800). The hinge sits on the
// start edge of the opening; the camera pushes through its centre.
const OPEN = { x: 480, y: 150, w: 240, h: 570 } as const;
const CENTER = { x: OPEN.x + OPEN.w / 2, y: OPEN.y + OPEN.h / 2 } as const;

/** One storefront card: body, awning, door/window shapes and a nameplate. */
function Shop({ x, y, w, h, awning, accent, plate }: { x: number; y: number; w: number; h: number; awning: string; accent: string; plate: string }) {
  // Scalloped awning: straight top edge, a row of arcs along the bottom.
  const scallops = Math.max(3, Math.round(w / 34));
  const sw = w / scallops;
  const edge = (i: number) => (i === 0 ? x - 6 : i === scallops ? x + w + 6 : x + i * sw);
  let d = `M${x - 6},${y} H${x + w + 6} V${y + 14}`;
  for (let i = scallops; i >= 1; i--) {
    const a = edge(i);
    const b = edge(i - 1);
    d += ` Q${(a + b) / 2},${y + 30} ${b},${y + 14}`;
  }
  d += ' Z';
  const doorW = Math.min(44, w * 0.32);
  return (
    <g data-shop>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={C.white} />
      <rect x={x} y={y} width={w} height={h} rx={6} fill="none" stroke={C.navy} strokeOpacity="0.12" />
      <path d={d} fill={awning} />
      <rect x={x - 6} y={y - 12} width={w + 12} height={14} rx={5} fill={C.navy} />
      {/* window */}
      <rect x={x + 18} y={y + 48} width={w - doorW - 48} height={Math.min(56, h * 0.36)} rx={5} fill={C.navy} />
      <rect x={x + 26} y={y + 56} width={14} height={14} rx={2} fill={C.ivory} fillOpacity="0.9" />
      {/* door */}
      <rect x={x + w - doorW - 18} y={y + 48} width={doorW} height={h - 48} rx={4} fill={accent} />
      <circle cx={x + w - 26} cy={y + h - 60} r={2.6} fill={C.navy} />
      {/* nameplate */}
      <g data-plate>
        <rect x={x + 10} y={y - 46} width={w - 20} height={26} rx={13} fill={C.ivory} />
        <text x={x + w / 2} y={y - 28} textAnchor="middle" fontSize="12.5" fontWeight="700" letterSpacing="0.02" fill={C.navy} fontFamily="Manrope, system-ui, sans-serif">
          {plate}
        </text>
      </g>
    </g>
  );
}

export function DoorStage({ labels }: { labels: Labels }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const pin = root.querySelector<HTMLElement>('.sd-door-pin');
      const wall = root.querySelector<SVGGElement>('[data-part="wall"]');
      const leaf = root.querySelector<SVGGElement>('[data-part="leaf"]');
      const glow = root.querySelector<SVGGElement>('[data-part="glow"]');
      const street = root.querySelector<SVGGElement>('[data-part="street"]');
      const shops = gsap.utils.toArray<SVGGElement>('[data-shop]', root);
      const plates = gsap.utils.toArray<SVGGElement>('[data-plate]', root);
      const captions = gsap.utils.toArray<HTMLElement>('.sd-door-caption', root);
      const chips = gsap.utils.toArray<HTMLElement>('.sd-door-chip', root);
      const bars = gsap.utils.toArray<HTMLElement>('.sd-door-bar i', root);
      const hint = root.querySelector<HTMLElement>('.sd-door-hint');
      const shade = root.querySelector<HTMLElement>('.sd-door-shade');
      if (!pin || !wall || !leaf || !street) return;
      // Captions sit at the start edge, so the street drifts toward the end edge.
      const drift = getComputedStyle(root).direction === 'rtl' ? -150 : 150;

      const origin = `${CENTER.x} ${CENTER.y}`;
      // The street "camera" is a plain object written to the transform
      // attribute by hand: mixing scale (svgOrigin) and x/y tweens on one SVG
      // group gets re-decomposed wrongly on invalidateOnRefresh.
      const cam = { s: 0.42, x: 0, y: 30 };
      const applyCam = () => {
        street.setAttribute('transform', `translate(${CENTER.x + cam.x} ${CENTER.y + cam.y}) scale(${cam.s}) translate(${-CENTER.x} ${-CENTER.y})`);
      };
      applyCam();

      // The film, normalised to 1 unit of progress. Scrubbed on desktop,
      // jumped to its end state on mobile where the section is static.
      const build = () => {
        const tl = gsap.timeline({ paused: true, defaults: { ease: EASE.linear } });
        // Act 1: the leaf swings open from its hinge, light pours out.
        tl.fromTo(leaf, { scaleX: 1, skewY: 0, svgOrigin: `${OPEN.x} ${CENTER.y}` }, { scaleX: 0.06, skewY: -7, duration: 0.3, ease: 'power2.inOut' }, 0);
        if (glow) tl.fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 0.25 }, 0.05);
        tl.fromTo(cam, { s: 0.42, y: 30 }, { s: 0.92, y: 0, duration: 0.55, ease: 'power2.inOut', onUpdate: applyCam }, 0.2);
        if (shade) tl.fromTo(shade, { opacity: 0.45 }, { opacity: 1, duration: 0.3 }, 0.3);
        // Act 2: the camera pushes through the frame; the wall grows past the
        // viewport and dissolves, the street spreads into a row.
        tl.fromTo(wall, { scale: 1, svgOrigin: origin }, { scale: 7, duration: 0.42, ease: 'power2.in' }, 0.24);
        tl.fromTo(wall, { opacity: 1 }, { opacity: 0, duration: 0.14 }, 0.5);
        tl.fromTo(shops, { y: 70, opacity: 0.6 }, { y: 0, opacity: 1, duration: 0.3, stagger: 0.03, ease: 'power2.out' }, 0.38);
        // Act 3: nameplates and chips surface; the street drifts to the start.
        tl.fromTo(plates, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.14, stagger: 0.02 }, 0.7);
        tl.fromTo(cam, { x: 0 }, { x: drift, duration: 0.4, ease: 'power1.inOut', onUpdate: applyCam }, 0.55);
        if (chips.length) {
          tl.fromTo(chips.slice(0, 2), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.1, stagger: 0.04 }, 0.4);
          tl.to(chips.slice(0, 2), { autoAlpha: 0, y: -14, duration: 0.08 }, 0.66);
          tl.fromTo(chips.slice(2), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.74);
        }
        // Captions: three beats, crossfade with a short rise.
        captions.forEach((cap, i) => {
          const at = i / 3;
          if (i === 0) tl.set(cap, { autoAlpha: 1, y: 0 }, 0);
          else tl.fromTo(cap, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.08, ease: 'power2.out' }, at);
          if (i < 2) tl.to(cap, { autoAlpha: 0, y: -24, duration: 0.06, ease: 'power2.in' }, at + 1 / 3 - 0.06);
        });
        bars.forEach((bar, i) => {
          tl.fromTo(bar, { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: 1 / 3 }, i / 3);
        });
        if (hint) tl.to(hint, { autoAlpha: 0, duration: 0.08 }, 0.08);
        return tl;
      };

      const mm = gsap.matchMedia();
      mm.add('(min-width: 900px)', () => {
        const tl = build();
        gsap.set(captions, { autoAlpha: 0 });
        gsap.set(captions[0], { autoAlpha: 1 });
        gsap.set(chips, { autoAlpha: 0 });
        const st = ScrollTrigger.create({
          trigger: root,
          start: 'top top',
          end: '+=250%',
          pin,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          animation: tl,
        });
        return () => st.kill();
      });
      mm.add('(max-width: 899px)', () => {
        // Static version: the door is already open, captions stack below the
        // stage and reveal one by one.
        const tl = build();
        tl.progress(1);
        gsap.set(captions, { clearProps: 'all' });
        gsap.set(chips, { autoAlpha: 1, clearProps: 'transform' });
        const tweens = captions.map((cap) =>
          gsap.fromTo(cap, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: EASE.expo, scrollTrigger: { trigger: cap, start: TRIGGER.reveal, once: true } }),
        );
        return () => {
          tweens.forEach((tw) => tw.scrollTrigger?.kill());
          tl.kill();
        };
      });

      fontsReady().then(() => refreshScroll());
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <section id="door" ref={ref} className="sd-door" aria-labelledby="sd-door-title">
      <div className="sd-door-pin">
        <div className="sd-door-stage" dir="ltr" aria-hidden="true">
          <svg className="sd-door-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" focusable="false">
            <defs>
              <radialGradient id="sd-door-light" cx="0.5" cy="0.55" r="0.6">
                <stop offset="0" stopColor={C.amber} stopOpacity="0.9" />
                <stop offset="0.45" stopColor={C.teal} stopOpacity="0.35" />
                <stop offset="1" stopColor={C.teal} stopOpacity="0" />
              </radialGradient>
              <linearGradient id="sd-door-ground" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={C.ivory} stopOpacity="0.14" />
                <stop offset="1" stopColor={C.ivory} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="sd-door-leaf" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={C.tealDeep} />
                <stop offset="1" stopColor={C.teal} />
              </linearGradient>
            </defs>

            {/* Street behind the door: lit storefronts on a dusk-navy ground */}
            <g data-part="street">
              <rect x="-600" y="-400" width="2400" height="1600" fill={C.navyDeep} />
              <circle cx="600" cy="300" r="520" fill="url(#sd-door-light)" opacity="0.55" />
              <rect x="-600" y="560" width="2400" height="640" fill="url(#sd-door-ground)" />
              <path d="M-600,560 H1800" stroke={C.ivory} strokeOpacity="0.18" strokeWidth="2" />
              {/* far rooftops */}
              <g opacity="0.35">
                <rect x="120" y="330" width="80" height="230" rx="6" fill={C.navy} />
                <rect x="260" y="290" width="60" height="270" rx="6" fill={C.navy} />
                <rect x="860" y="300" width="90" height="260" rx="6" fill={C.navy} />
                <rect x="1010" y="340" width="70" height="220" rx="6" fill={C.navy} />
                <circle cx="930" cy="230" r="34" fill={C.amber} fillOpacity="0.8" />
              </g>
              <Shop x={70} y={400} w={170} h={160} awning={C.teal} accent={C.amber} plate="atelier-nord.se" />
              <Shop x={290} y={380} w={200} h={180} awning={C.amber} accent={C.teal} plate="kaffe-lumi.shop" />
              <Shop x={540} y={360} w={120} h={200} awning={C.teal} accent={C.amber} plate="ker.studio" />
              <Shop x={710} y={390} w={210} h={170} awning={C.amber} accent={C.teal} plate="papier.com" />
              <Shop x={970} y={410} w={170} h={150} awning={C.teal} accent={C.amber} plate="verde-plants.de" />
              {/* foreground plant + bench */}
              <rect x="640" y="520" width="34" height="40" rx="8" fill={C.amber} />
              <path d="M657,520 C640,490 626,484 650,450 C680,470 672,500 657,520 Z" fill={C.tealDeep} />
              <path d="M657,520 C672,494 690,490 686,460 C664,470 658,496 657,520 Z" fill={C.teal} />
              <ellipse cx="600" cy="572" rx="420" ry="10" fill={C.navy} fillOpacity="0.5" />
            </g>

            {/* Light spilling through the opening */}
            <g data-part="glow">
              <path d={`M${OPEN.x},${OPEN.y + OPEN.h} L${OPEN.x + OPEN.w},${OPEN.y + OPEN.h} L${OPEN.x + OPEN.w + 300},800 L${OPEN.x - 220},800 Z`} fill={C.amber} fillOpacity="0.16" />
            </g>

            {/* Wall with the door opening punched out (evenodd) + the frame */}
            <g data-part="wall">
              <path
                d={`M-3000,-3000 H4200 V3800 H-3000 Z M${OPEN.x},${OPEN.y} H${OPEN.x + OPEN.w} V${OPEN.y + OPEN.h} H${OPEN.x} Z`}
                fill={C.navy}
                fillRule="evenodd"
              />
              <path d={`M${OPEN.x - 40},${OPEN.y + OPEN.h} V${OPEN.y - 40} H${OPEN.x + OPEN.w + 40} V${OPEN.y + OPEN.h} H${OPEN.x + OPEN.w} V${OPEN.y} H${OPEN.x} V${OPEN.y + OPEN.h} Z`} fill={C.navyDeep} />
              <rect x={OPEN.x - 60} y={OPEN.y + OPEN.h} width={OPEN.w + 120} height="10" rx="3" fill={C.navyDeep} />
              <g data-part="leaf">
                <rect x={OPEN.x} y={OPEN.y} width={OPEN.w} height={OPEN.h} fill="url(#sd-door-leaf)" />
                <rect x={OPEN.x + 28} y={OPEN.y + 40} width={OPEN.w - 56} height="170" rx="6" fill={C.tealDeep} fillOpacity="0.55" />
                <rect x={OPEN.x + 28} y={OPEN.y + 250} width={OPEN.w - 56} height="230" rx="6" fill={C.tealDeep} fillOpacity="0.55" />
                <circle cx={OPEN.x + OPEN.w - 30} cy={CENTER.y + 40} r="7" fill={C.ivory} />
              </g>
            </g>
          </svg>

          <div className="sd-door-shade" />
          {/* Floating facts for beat 2 and 3 (HTML so the type stays crisp) */}
          <div className="sd-door-chip sd-door-chip-a" dir="auto">{labels.chips.currencies}</div>
          <div className="sd-door-chip sd-door-chip-b" dir="auto">{labels.chips.languages}</div>
          <div className="sd-door-chip sd-door-chip-c" dir="auto">{labels.chips.domain}</div>
        </div>

        <div className="sd-container sd-door-copy">
          <h2 id="sd-door-title" className="sd-door-eyebrow">
            <span className="sd-eyebrow sd-eyebrow-ivory">
              <span className="sd-eyebrow-dot" aria-hidden="true" />
              {labels.eyebrow}
            </span>
            <span className="sd-sr-only">{labels.title}</span>
          </h2>
          <div className="sd-door-captions">
            {labels.captions.map((cap, i) => (
              <div key={i} className="sd-door-caption">
                <span className="sd-door-index" dir="ltr" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="sd-door-caption-title">{cap.title}</p>
                <p className="sd-door-caption-sub">{cap.sub}</p>
              </div>
            ))}
          </div>
          <div className="sd-door-bars" aria-hidden="true">
            {labels.captions.map((_, i) => (
              <span key={i} className="sd-door-bar">
                <i />
              </span>
            ))}
          </div>
        </div>
        <p className="sd-door-hint" aria-hidden="true">
          {labels.scrollHint}
        </p>
      </div>
    </section>
  );
}
