'use client';

import { useRef, useState, type ReactNode } from 'react';
import { gsap, useGSAP, EASE, TRIGGER, isFinePointer } from '@/lib/animations';

export type FeatureKey = 'builder' | 'products' | 'orders' | 'payments' | 'markets' | 'domains' | 'analytics' | 'marketing';

interface Item {
  key: FeatureKey;
  index: string;
  title: string;
  desc: string;
  live: boolean;
}

interface Props {
  items: Item[];
  soonLabel: string;
  liveLabel: string;
}

const C = { navy: '#142D36', teal: '#15B8A6', tealDeep: '#0F9484', ivory: '#F7F4EC', ivory2: '#EFEAE0', amber: '#F4B544', line: '#E6E0D3' } as const;

// Mini illustrations (240 x 160) drawn with the brand palette only.
const ART: Record<FeatureKey, ReactNode> = {
  builder: (
    <g>
      <rect x="28" y="24" width="184" height="112" rx="10" fill={C.ivory} />
      <rect x="40" y="36" width="160" height="22" rx="6" fill={C.navy} />
      <rect x="40" y="66" width="76" height="58" rx="6" fill={C.teal} />
      <rect x="124" y="66" width="76" height="26" rx="6" fill={C.amber} />
      <rect x="124" y="98" width="76" height="26" rx="6" fill={C.line} />
    </g>
  ),
  products: (
    <g>
      <rect x="44" y="70" width="60" height="60" rx="8" fill={C.navy} />
      <rect x="110" y="50" width="80" height="80" rx="8" fill={C.teal} />
      <rect x="70" y="36" width="56" height="44" rx="8" fill={C.amber} />
      <path d="M44,100 h60 M110,90 h80" stroke={C.ivory} strokeOpacity=".6" strokeWidth="3" />
    </g>
  ),
  orders: (
    <g>
      <path d="M24,120 C70,60 120,140 160,70 S210,60 216,54" fill="none" stroke={C.line} strokeWidth="3" strokeDasharray="6 8" />
      <rect x="128" y="86" width="56" height="34" rx="6" fill={C.navy} />
      <path d="M184,96 h20 l10,12 v12 h-30 z" fill={C.teal} />
      <circle cx="142" cy="124" r="7" fill={C.amber} />
      <circle cx="202" cy="124" r="7" fill={C.amber} />
      <circle cx="30" cy="116" r="6" fill={C.teal} />
    </g>
  ),
  payments: (
    <g>
      <rect x="40" y="44" width="160" height="96" rx="12" fill={C.navy} />
      <rect x="40" y="66" width="160" height="18" fill={C.teal} />
      <rect x="56" y="100" width="54" height="10" rx="5" fill={C.ivory} fillOpacity=".7" />
      <circle cx="170" cy="112" r="11" fill={C.amber} />
      <circle cx="156" cy="112" r="11" fill={C.ivory} fillOpacity=".85" />
    </g>
  ),
  markets: (
    <g>
      <circle cx="120" cy="82" r="52" fill="none" stroke={C.navy} strokeWidth="3" />
      <ellipse cx="120" cy="82" rx="22" ry="52" fill="none" stroke={C.navy} strokeWidth="2" strokeOpacity=".5" />
      <path d="M68,82 h104 M78,58 h84 M78,106 h84" stroke={C.navy} strokeWidth="2" strokeOpacity=".5" />
      <circle cx="96" cy="64" r="6" fill={C.teal} />
      <circle cx="150" cy="96" r="6" fill={C.amber} />
      <circle cx="132" cy="52" r="5" fill={C.teal} />
    </g>
  ),
  domains: (
    <g>
      <rect x="32" y="62" width="176" height="36" rx="18" fill={C.ivory} stroke={C.line} />
      <circle cx="54" cy="80" r="7" fill={C.teal} />
      <rect x="70" y="75" width="86" height="10" rx="5" fill={C.navy} />
      <path d="M160,80 h32" stroke={C.amber} strokeWidth="4" strokeLinecap="round" />
      <path d="M126,118 a14,14 0 0 1 28,0 M140,118 v18" stroke={C.teal} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  ),
  analytics: (
    <g>
      <rect x="44" y="96" width="24" height="40" rx="4" fill={C.line} />
      <rect x="80" y="76" width="24" height="60" rx="4" fill={C.teal} />
      <rect x="116" y="54" width="24" height="82" rx="4" fill={C.navy} />
      <rect x="152" y="86" width="24" height="50" rx="4" fill={C.teal} />
      <rect x="188" y="40" width="24" height="96" rx="4" fill={C.amber} />
    </g>
  ),
  marketing: (
    <g>
      <rect x="44" y="48" width="152" height="94" rx="10" fill={C.navy} />
      <path d="M44,58 l76,52 l76,-52" fill="none" stroke={C.teal} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="196" cy="48" r="14" fill={C.amber} />
    </g>
  ),
};

/**
 * Numbered editorial rows plus a floating preview (240 x 160) that follows
 * the pointer over the list on fine-pointer devices. Rows and their titles
 * reveal on scroll with a masked line.
 */
export function FeaturePreview({ items, soonLabel, liveLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<FeatureKey | null>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const rows = gsap.utils.toArray<HTMLElement>('.sd-feature-row', root);
      const list = root.querySelector<HTMLElement>('.sd-features-list');
      const card = root.querySelector<HTMLElement>('.sd-feature-preview');

      // Reveal: each row fades/rises, its title slides up inside its own mask.
      rows.forEach((row) => {
        const title = row.querySelector<HTMLElement>('.sd-feature-title-inner');
        const tl = gsap.timeline({ scrollTrigger: { trigger: row, start: TRIGGER.reveal, once: true } });
        tl.fromTo(row, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: EASE.expo });
        if (title) tl.fromTo(title, { yPercent: 110 }, { yPercent: 0, duration: 1.2, ease: EASE.expo }, 0.08);
      });

      // Preview card follows the cursor (fine pointers only).
      if (!list || !card || !isFinePointer()) return;
      gsap.set(card, { xPercent: -50, yPercent: -50, autoAlpha: 0, scale: 0.9 });
      const xTo = gsap.quickTo(card, 'x', { duration: 0.5, ease: 'power3.out' });
      const yTo = gsap.quickTo(card, 'y', { duration: 0.5, ease: 'power3.out' });
      const move = (e: PointerEvent) => {
        const r = root.getBoundingClientRect();
        xTo(e.clientX - r.left);
        yTo(e.clientY - r.top);
      };
      const enter = (e: PointerEvent) => {
        move(e);
        gsap.to(card, { autoAlpha: 1, scale: 1, duration: 0.5, ease: EASE.expo, overwrite: 'auto' });
      };
      const leave = () => {
        gsap.to(card, { autoAlpha: 0, scale: 0.9, duration: 0.35, ease: EASE.soft, overwrite: 'auto' });
      };
      list.addEventListener('pointerenter', enter);
      list.addEventListener('pointermove', move);
      list.addEventListener('pointerleave', leave);
      return () => {
        list.removeEventListener('pointerenter', enter);
        list.removeEventListener('pointermove', move);
        list.removeEventListener('pointerleave', leave);
      };
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="sd-features-body">
      <ul className="sd-features-list" onPointerLeave={() => setActive(null)}>
        {items.map((item) => (
          <li
            key={item.key}
            className={`sd-feature-row ${item.live ? '' : 'is-soon'}`.trim()}
            data-reveal="block"
            onPointerEnter={() => setActive(item.key)}
            onFocus={() => setActive(item.key)}
          >
            <span className="sd-feature-index" dir="ltr" aria-hidden="true">
              {item.index}
            </span>
            <h3 className="sd-feature-title">
              <span className="sd-feature-title-inner">{item.title}</span>
            </h3>
            <p className="sd-feature-desc">{item.desc}</p>
            <span className={`sd-feature-status ${item.live ? 'is-live' : ''}`.trim()}>
              {item.live ? <span className="sd-feature-live-dot" aria-hidden="true" /> : null}
              {item.live ? liveLabel : <span className="sd-chip sd-chip-soon">{soonLabel}</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="sd-feature-preview" aria-hidden="true">
          <svg viewBox="0 0 240 160" width="240" height="160" focusable="false">
          {items.map((item) => (
            <g key={item.key} className={`sd-feature-art ${active === item.key ? 'is-active' : ''}`.trim()}>
              {ART[item.key]}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
