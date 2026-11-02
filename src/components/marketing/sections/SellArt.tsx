'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, ScrollTrigger, useGSAP, EASE, STAGGER, TRIGGER } from '@/lib/animations';

export type SellKey = 'own' | 'custom' | 'supplier' | 'bundle';

// Brand palette only: ivory panels, navy ink, teal as the living colour and
// amber as the spark. Elements tagged `data-float` drift, `data-pulse`
// breathe and `data-spin` rotate slowly, all only when motion is allowed.
const C = { navy: '#142D36', navyDeep: '#0E2129', teal: '#15B8A6', tealDeep: '#0F9484', ivory: '#F7F4EC', ivory2: '#EFEAE0', amber: '#F4B544', line: '#E6E0D3', white: '#FFFFFF' } as const;
const FONT = 'Manrope, system-ui, sans-serif';

/** Own products: a tee on a rail with size + colour variants and a stock tag. */
function OwnArt() {
  return (
    <svg viewBox="0 0 320 200" className="sd-sell-svg" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="320" height="200" fill={C.ivory2} />
      {/* Rail */}
      <path d="M24 34 H296" stroke={C.navy} strokeOpacity=".18" strokeWidth="3" strokeLinecap="round" />
      <g data-float>
        {/* Hanger */}
        <path d="M160 36 v10 M124 64 L160 46 L196 64" fill="none" stroke={C.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Tee */}
        <path d="M112 86 L138 66 h44 l26 20 -14 20 -10 -6 v70 h-76 v-70 l-10 6 z" fill={C.teal} />
        <path d="M138 66 c6 10 38 10 44 0" fill="none" stroke={C.ivory} strokeWidth="3" strokeLinecap="round" />
        <rect x="140" y="112" width="40" height="6" rx="3" fill={C.ivory} opacity=".85" />
        <rect x="148" y="124" width="24" height="5" rx="2.5" fill={C.ivory} opacity=".55" />
      </g>
      {/* Size chips + colour swatches */}
      <g data-float data-float-delay>
        <rect x="226" y="84" width="34" height="24" rx="8" fill={C.white} stroke={C.line} />
        <text x="243" y="100" textAnchor="middle" fontFamily={FONT} fontSize="11" fontWeight="700" fill={C.navy}>S</text>
        <rect x="266" y="84" width="34" height="24" rx="8" fill={C.navy} />
        <text x="283" y="100" textAnchor="middle" fontFamily={FONT} fontSize="11" fontWeight="700" fill={C.ivory}>M</text>
        <rect x="226" y="114" width="34" height="24" rx="8" fill={C.white} stroke={C.line} />
        <text x="243" y="130" textAnchor="middle" fontFamily={FONT} fontSize="11" fontWeight="700" fill={C.navy}>L</text>
        <circle cx="236" cy="158" r="7" fill={C.teal} />
        <circle cx="256" cy="158" r="7" fill={C.amber} />
        <circle cx="276" cy="158" r="7" fill={C.navy} />
        <circle cx="236" cy="158" r="10" fill="none" stroke={C.navy} strokeWidth="1.5" />
      </g>
      {/* Stock tag */}
      <g data-float>
        <rect x="28" y="130" width="72" height="30" rx="9" fill={C.white} stroke={C.line} />
        <circle cx="44" cy="145" r="4" fill={C.teal} data-pulse />
        <rect x="54" y="141" width="36" height="8" rx="4" fill={C.navy} opacity=".7" />
      </g>
    </svg>
  );
}

/** Personalised: a wooden name sign under a laser head, with a photo tile. */
function CustomArt() {
  return (
    <svg viewBox="0 0 320 200" className="sd-sell-svg" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="320" height="200" fill={C.ivory2} />
      {/* Wooden sign */}
      <g data-float>
        <rect x="46" y="78" width="196" height="84" rx="16" fill={C.amber} />
        <rect x="46" y="78" width="196" height="84" rx="16" fill="none" stroke={C.navy} strokeOpacity=".18" strokeWidth="2" />
        <path d="M62 96 q60 -8 120 0 M62 146 q60 8 120 0" fill="none" stroke={C.navy} strokeOpacity=".16" strokeWidth="2" />
        {/* Engraved script line standing in for a name */}
        <path d="M78 126 c8 -22 16 -22 20 -4 c3 14 10 14 14 0 c4 -16 12 -16 16 0 c4 14 12 14 16 -4 c4 -18 12 -18 18 0 c4 14 12 10 18 0" fill="none" stroke={C.navy} strokeWidth="3.5" strokeLinecap="round" data-draw />
        <rect x="104" y="140" width="60" height="4" rx="2" fill={C.navy} opacity=".4" />
      </g>
      {/* Laser head */}
      <g data-float data-float-delay>
        <rect x="132" y="22" width="40" height="30" rx="8" fill={C.navy} />
        <rect x="146" y="52" width="12" height="10" rx="3" fill={C.navyDeep} />
        <path d="M152 62 V118" stroke={C.teal} strokeWidth="2" strokeDasharray="4 4" />
        <circle cx="152" cy="120" r="6" fill={C.teal} data-pulse />
        <circle cx="152" cy="120" r="12" fill={C.teal} opacity=".25" data-pulse />
      </g>
      {/* Photo tile with a tiny landscape */}
      <g data-float>
        <rect x="236" y="104" width="62" height="62" rx="12" fill={C.white} stroke={C.line} />
        <rect x="244" y="112" width="46" height="34" rx="6" fill={C.teal} opacity=".85" />
        <circle cx="256" cy="122" r="5" fill={C.amber} />
        <path d="M244 146 l14 -14 l10 9 l8 -7 l14 12 z" fill={C.navy} opacity=".8" />
        <rect x="248" y="152" width="30" height="5" rx="2.5" fill={C.navy} opacity=".35" />
      </g>
    </svg>
  );
}

/** Supplier: a parcel travels from the supplier's warehouse to your store tag. */
function SupplierArt() {
  return (
    <svg viewBox="0 0 320 200" className="sd-sell-svg" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="320" height="200" fill={C.ivory2} />
      {/* Route */}
      <path d="M72 128 C120 60 200 180 262 96" fill="none" stroke={C.navy} strokeOpacity=".25" strokeWidth="2.5" strokeDasharray="6 8" data-draw />
      {/* Warehouse */}
      <g>
        <path d="M28 128 v-38 l34 -22 l34 22 v38 z" fill={C.white} stroke={C.line} strokeWidth="2" />
        <rect x="50" y="104" width="24" height="24" rx="3" fill={C.navy} opacity=".8" />
        <rect x="36" y="96" width="10" height="6" rx="2" fill={C.teal} />
        <rect x="78" y="96" width="10" height="6" rx="2" fill={C.teal} />
        <path d="M24 128 H104" stroke={C.navy} strokeOpacity=".2" strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Parcel on the route */}
      <g data-float>
        <path d="M138 86 l34 -14 l34 14 v40 l-34 14 l-34 -14 z" fill={C.amber} />
        <path d="M138 86 l34 14 l34 -14 M172 100 v40" fill="none" stroke={C.navy} strokeOpacity=".35" strokeWidth="2" strokeLinejoin="round" />
        <path d="M156 79 l34 14 v12" fill="none" stroke={C.ivory} strokeWidth="3" strokeLinecap="round" />
        <circle cx="206" cy="82" r="5" fill={C.teal} data-pulse />
      </g>
      {/* Store tag carrying your brand */}
      <g data-float data-float-delay>
        <rect x="228" y="100" width="72" height="56" rx="14" fill={C.teal} />
        <rect x="228" y="100" width="72" height="18" rx="9" fill={C.tealDeep} />
        <rect x="236" y="106" width="22" height="6" rx="3" fill={C.ivory} />
        <circle cx="290" cy="109" r="3" fill={C.amber} />
        <rect x="240" y="128" width="30" height="6" rx="3" fill={C.ivory} opacity=".9" />
        <rect x="240" y="140" width="48" height="5" rx="2.5" fill={C.ivory} opacity=".55" />
      </g>
    </svg>
  );
}

/** Bundles: a gift box with a ribbon and two small items tied into one offer. */
function BundleArt() {
  return (
    <svg viewBox="0 0 320 200" className="sd-sell-svg" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="320" height="200" fill={C.ivory2} />
      {/* Gift box */}
      <g data-float>
        <rect x="104" y="92" width="112" height="78" rx="10" fill={C.navy} />
        <rect x="94" y="72" width="132" height="30" rx="9" fill={C.navyDeep} />
        <rect x="150" y="72" width="20" height="98" fill={C.amber} />
        <path d="M160 72 c-26 -2 -36 -22 -22 -30 c12 -6 20 12 22 30 c2 -18 10 -36 22 -30 c14 8 4 28 -22 30 z" fill={C.amber} />
        <path d="M160 72 c-26 -2 -36 -22 -22 -30 c12 -6 20 12 22 30 c2 -18 10 -36 22 -30 c14 8 4 28 -22 30 z" fill="none" stroke={C.navy} strokeOpacity=".3" strokeWidth="2" />
      </g>
      {/* Items inside the set */}
      <g data-float data-float-delay>
        <rect x="34" y="104" width="54" height="54" rx="12" fill={C.white} stroke={C.line} />
        <circle cx="61" cy="131" r="14" fill={C.teal} />
        <circle cx="61" cy="131" r="6" fill={C.ivory} />
      </g>
      <g data-float>
        <rect x="232" y="96" width="54" height="62" rx="12" fill={C.white} stroke={C.line} />
        <rect x="244" y="108" width="30" height="24" rx="5" fill={C.amber} />
        <rect x="244" y="138" width="22" height="5" rx="2.5" fill={C.navy} opacity=".55" />
      </g>
      {/* Plus / equals connectors */}
      <path d="M92 131 h10 M97 126 v10" stroke={C.navy} strokeWidth="3" strokeLinecap="round" />
      <path d="M220 126 h10 M220 134 h10" stroke={C.navy} strokeWidth="3" strokeLinecap="round" />
      {/* Sparks */}
      <path d="M248 50 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" fill={C.teal} data-spin />
      <circle cx="62" cy="70" r="5" fill={C.amber} data-pulse />
    </svg>
  );
}

const ART: Record<SellKey, () => ReactNode> = { own: OwnArt, custom: CustomArt, supplier: SupplierArt, bundle: BundleArt };

export function SellArt({ art }: { art: SellKey }) {
  const Art = ART[art];
  return <Art />;
}

/**
 * Client wrapper for the shelf of cards: staggered rise-in on scroll, drawn
 * strokes, then looping micro-motion on the illustrations. The loops are
 * created only inside a `prefers-reduced-motion: no-preference` match so a
 * reduced-motion user gets the static picture (same guard as ShaderBackdrop).
 */
export function SellShelf({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      const list = ref.current;
      if (!list) return;
      const cards = gsap.utils.toArray<HTMLElement>('.sd-sell-card', list);
      const draws = gsap.utils.toArray<SVGGeometryElement>('[data-draw]', list);
      draws.forEach((d) => d.setAttribute('pathLength', '1'));

      // The wrapper carries `data-reveal="stagger"` (hidden until JS), so it
      // must be made visible explicitly before the children animate in.
      gsap.set(list, { visibility: 'visible' });
      const tl = gsap.timeline({ paused: true });
      tl.fromTo(cards, { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: EASE.expo, stagger: STAGGER.base }, 0);
      if (draws.length) tl.fromTo(draws, { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: EASE.inOut, stagger: 0.1 }, 0.5);
      ScrollTrigger.create({ trigger: list, start: TRIGGER.reveal, once: true, onEnter: () => tl.play() });

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.utils.toArray<Element>('[data-float]', list).forEach((el, i) => {
          gsap.to(el, { y: i % 2 ? -5 : 5, duration: 3.2 + (i % 3) * 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: el.hasAttribute('data-float-delay') ? 0.8 : 0 });
        });
        gsap.utils.toArray<Element>('[data-pulse]', list).forEach((el, i) => {
          gsap.to(el, { scale: 1.35, opacity: 0.45, transformOrigin: '50% 50%', duration: 1.4 + (i % 2) * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
        });
        gsap.utils.toArray<Element>('[data-spin]', list).forEach((el) => {
          gsap.to(el, { rotation: 360, transformOrigin: '50% 50%', duration: 14, ease: 'none', repeat: -1 });
        });
      });
    },
    { scope: ref },
  );

  return (
    <ul ref={ref} className="sd-sell-shelf" data-reveal="stagger">
      {children}
    </ul>
  );
}
