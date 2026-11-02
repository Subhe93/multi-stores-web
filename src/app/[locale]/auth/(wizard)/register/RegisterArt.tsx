// Illustrated headers of the three sign-up paths, in the style of the landing
// page's SellArt: brand palette only (navy, teal, ivory, amber), inline and
// lightweight. Decorative — every SVG is aria-hidden; the card text carries
// the meaning.

const C = { navy: '#142D36', navyDeep: '#0E2129', teal: '#15B8A6', tealDeep: '#0F9484', ivory: '#F7F4EC', ivory2: '#EFEAE0', amber: '#F4B544', line: '#E6E0D3', white: '#FFFFFF' } as const;
const FONT = 'Manrope, system-ui, sans-serif';

/** Independent store: a storefront under its own domain, with its own card terminal. */
function IndependentArt() {
  return (
    <svg viewBox="0 0 320 180" direction="ltr" aria-hidden="true" focusable="false">
      <rect width="320" height="180" fill={C.ivory2} />
      {/* Ground line */}
      <path d="M40 150 H280" stroke={C.navy} strokeOpacity=".18" strokeWidth="2.5" strokeLinecap="round" />
      {/* Shop body */}
      <rect x="86" y="78" width="148" height="72" rx="6" fill={C.white} stroke={C.line} strokeWidth="2" />
      {/* Awning: teal with ivory stripes */}
      <path d="M76 70 h168 l8 18 q-6 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 q-7 10 -14 0 z" fill={C.teal} />
      {[90, 118, 146, 174, 202, 230].map((x) => (
        <rect key={x} x={x} y="70" width="14" height="19" fill={C.ivory} opacity=".55" />
      ))}
      <rect x="76" y="66" width="168" height="6" rx="3" fill={C.tealDeep} />
      {/* Door + windows */}
      <rect x="146" y="106" width="28" height="44" rx="4" fill={C.navy} />
      <circle cx="168" cy="130" r="2" fill={C.amber} />
      <rect x="100" y="104" width="34" height="26" rx="4" fill={C.ivory2} stroke={C.line} />
      <rect x="186" y="104" width="34" height="26" rx="4" fill={C.ivory2} stroke={C.line} />
      <path d="M104 126 l10 -10 l8 7 l8 -8 l4 4" fill="none" stroke={C.teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="192" y="110" width="14" height="4" rx="2" fill={C.navy} opacity=".5" />
      <rect x="192" y="118" width="22" height="4" rx="2" fill={C.navy} opacity=".3" />
      {/* Own domain pill above the shop */}
      <rect x="104" y="28" width="112" height="26" rx="13" fill={C.white} stroke={C.line} strokeWidth="1.5" />
      <circle cx="120" cy="41" r="5" fill={C.teal} />
      <path d="M118 41 l1.5 1.5 l3 -3" fill="none" stroke={C.white} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="132" y="45" fontFamily={FONT} fontSize="11" fontWeight="700" fill={C.navy} letterSpacing="-0.2">
        yourbrand.com
      </text>
      {/* Payment card: own payments */}
      <g transform="rotate(-8 272 118)">
        <rect x="246" y="100" width="52" height="34" rx="7" fill={C.amber} />
        <rect x="246" y="108" width="52" height="7" fill={C.navy} opacity=".55" />
        <rect x="252" y="121" width="18" height="5" rx="2.5" fill={C.navy} opacity=".55" />
        <circle cx="286" cy="124" r="4" fill={C.white} opacity=".9" />
      </g>
      {/* Spark */}
      <path d="M52 112 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" fill={C.teal} />
    </svg>
  );
}

/** Marketplace / creator store: a megaphone sending supplier parcels to an audience. */
function MarketplaceArt() {
  return (
    <svg viewBox="0 0 320 180" direction="ltr" aria-hidden="true" focusable="false">
      <rect width="320" height="180" fill={C.ivory2} />
      {/* Megaphone */}
      <g transform="rotate(-10 110 100)">
        <path d="M60 86 h30 l60 -30 v88 l-60 -30 h-30 z" fill={C.navy} />
        <rect x="52" y="84" width="22" height="32" rx="8" fill={C.navyDeep} />
        <rect x="150" y="50" width="12" height="100" rx="6" fill={C.teal} />
        <rect x="70" y="118" width="20" height="26" rx="6" fill={C.navyDeep} />
      </g>
      {/* Sound arcs */}
      <path d="M182 72 q14 28 0 56" fill="none" stroke={C.teal} strokeWidth="3" strokeLinecap="round" />
      <path d="M198 60 q24 40 0 80" fill="none" stroke={C.teal} strokeWidth="3" strokeLinecap="round" opacity=".55" />
      <path d="M214 50 q32 50 0 100" fill="none" stroke={C.teal} strokeWidth="3" strokeLinecap="round" opacity=".3" />
      {/* Supplier parcels on their way to the audience */}
      <g transform="rotate(12 250 60)">
        <path d="M232 52 l18 -8 l18 8 v22 l-18 8 l-18 -8 z" fill={C.amber} />
        <path d="M232 52 l18 8 l18 -8 M250 60 v22" fill="none" stroke={C.navy} strokeOpacity=".35" strokeWidth="1.8" strokeLinejoin="round" />
      </g>
      <g transform="rotate(-8 268 118)">
        <path d="M250 110 l18 -8 l18 8 v22 l-18 8 l-18 -8 z" fill={C.white} stroke={C.line} strokeWidth="1.5" />
        <path d="M250 110 l18 8 l18 -8 M268 118 v22" fill="none" stroke={C.navy} strokeOpacity=".3" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="280" cy="106" r="4" fill={C.teal} />
      </g>
      {/* Audience chips: heart + follower avatars */}
      <rect x="226" y="146" width="66" height="22" rx="11" fill={C.white} stroke={C.line} strokeWidth="1.5" />
      <circle cx="240" cy="157" r="6" fill={C.teal} />
      <circle cx="250" cy="157" r="6" fill={C.amber} stroke={C.white} strokeWidth="1.5" />
      <circle cx="260" cy="157" r="6" fill={C.navy} stroke={C.white} strokeWidth="1.5" />
      <path d="M278 153 c-2 -3 -6 -1 -5 2 c1 2 5 5 5 5 s4 -3 5 -5 c1 -3 -3 -5 -5 -2 z" fill={C.teal} />
      {/* Commission / platform payments tag */}
      <rect x="36" y="150" width="56" height="22" rx="11" fill={C.teal} />
      <text x="64" y="165" textAnchor="middle" fontFamily={FONT} fontSize="11" fontWeight="700" fill={C.white}>
        %
      </text>
    </svg>
  );
}

/** Supplier: a warehouse with stacked boxes and the admin's verification badge. */
function SupplierArt() {
  return (
    <svg viewBox="0 0 320 180" direction="ltr" aria-hidden="true" focusable="false">
      <rect width="320" height="180" fill={C.ivory2} />
      <path d="M30 150 H290" stroke={C.navy} strokeOpacity=".18" strokeWidth="2.5" strokeLinecap="round" />
      {/* Warehouse */}
      <path d="M60 150 v-62 l56 -34 l56 34 v62 z" fill={C.white} stroke={C.line} strokeWidth="2" />
      <path d="M52 92 l64 -40 l64 40" fill="none" stroke={C.navy} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="98" y="110" width="36" height="40" rx="3" fill={C.navy} />
      <path d="M98 120 h36 M98 130 h36 M98 140 h36" stroke={C.ivory} strokeOpacity=".4" strokeWidth="1.5" />
      <rect x="72" y="100" width="14" height="10" rx="2" fill={C.teal} />
      <rect x="146" y="100" width="14" height="10" rx="2" fill={C.teal} />
      {/* Stacked boxes */}
      <rect x="188" y="118" width="32" height="32" rx="4" fill={C.amber} />
      <rect x="222" y="118" width="32" height="32" rx="4" fill={C.amber} opacity=".85" />
      <rect x="205" y="86" width="32" height="32" rx="4" fill={C.amber} />
      <path d="M188 134 h32 M204 118 v32 M222 134 h32 M238 118 v32 M205 102 h32 M221 86 v32" stroke={C.navy} strokeOpacity=".28" strokeWidth="1.5" />
      <path d="M196 126 h10 M230 126 h10 M213 94 h10" stroke={C.ivory} strokeWidth="2.5" strokeLinecap="round" />
      {/* Clipboard: the catalog listing */}
      <rect x="60" y="40" width="44" height="54" rx="6" fill={C.white} stroke={C.line} strokeWidth="1.5" />
      <rect x="72" y="35" width="20" height="10" rx="4" fill={C.navy} />
      <path d="M68 58 h28 M68 68 h28 M68 78 h18" stroke={C.navy} strokeOpacity=".3" strokeWidth="2.5" strokeLinecap="round" />
      {/* Verification badge */}
      <circle cx="276" cy="96" r="20" fill={C.teal} />
      <circle cx="276" cy="96" r="25" fill="none" stroke={C.teal} strokeOpacity=".3" strokeWidth="3" />
      <path d="M267 96 l6 6 l12 -12" fill="none" stroke={C.white} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Route from the warehouse to the boxes */}
      <path d="M152 66 C178 44 200 48 216 66" fill="none" stroke={C.navy} strokeOpacity=".25" strokeWidth="2.5" strokeDasharray="5 7" strokeLinecap="round" />
    </svg>
  );
}

export type RegisterArtKey = 'independent' | 'marketplace' | 'supplier';

const ART: Record<RegisterArtKey, () => React.ReactNode> = {
  independent: IndependentArt,
  marketplace: MarketplaceArt,
  supplier: SupplierArt,
};

export function RegisterArt({ art }: { art: RegisterArtKey }) {
  const Art = ART[art];
  return <Art />;
}
