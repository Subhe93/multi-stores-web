// Inline illustrations for the three "how it works" panels. Pure shapes in the
// brand palette (ivory lines, teal as the living colour, amber as the spark)
// so they scale crisply inside the clip-path reveal and never need a photo.
// Elements tagged `data-float` drift slowly; `data-draw` strokes draw in.

const IVORY = '#F7F4EC';
const TEAL = '#15B8A6';
const AMBER = '#F4B544';
const NAVY = '#142D36';

export type HowArtKey = 's1' | 's2' | 's3';

function DoorArt() {
  return (
    <svg viewBox="0 0 420 320" className="sd-how-svg" aria-hidden="true" focusable="false">
      {/* Floor line */}
      <path d="M24 284 H396" stroke={IVORY} strokeOpacity=".22" strokeWidth="2" strokeLinecap="round" data-draw />
      {/* Door frame */}
      <path d="M150 284 V72 H270 V284" fill="none" stroke={IVORY} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" data-draw />
      <rect x="150" y="72" width="120" height="212" fill={NAVY} opacity=".35" />
      {/* Door leaf, swung open toward the viewer */}
      <g data-float>
        <path d="M156 78 L232 54 V268 L156 284 Z" fill={TEAL} />
        <path d="M156 78 L232 54 V268 L156 284 Z" fill="none" stroke={IVORY} strokeOpacity=".28" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="214" cy="166" r="5" fill={IVORY} />
      </g>
      {/* Nameplate above the door */}
      <g data-float data-float-delay>
        <rect x="128" y="22" width="164" height="38" rx="10" fill={AMBER} />
        <rect x="146" y="35" width="78" height="6" rx="3" fill={NAVY} />
        <rect x="146" y="46" width="48" height="4" rx="2" fill={NAVY} opacity=".55" />
        <circle cx="264" cy="41" r="8" fill={NAVY} />
      </g>
      {/* Awning stripes */}
      <path d="M118 108 H152" stroke={IVORY} strokeOpacity=".35" strokeWidth="4" strokeLinecap="round" />
      <path d="M268 108 H302" stroke={IVORY} strokeOpacity=".35" strokeWidth="4" strokeLinecap="round" />
      {/* Soft light spilling through the door */}
      <ellipse cx="214" cy="284" rx="88" ry="10" fill={TEAL} opacity=".25" />
      {/* Theme swatches to the side */}
      <g data-float>
        <rect x="318" y="196" width="60" height="60" rx="14" fill={IVORY} opacity=".1" stroke={IVORY} strokeOpacity=".3" strokeWidth="2" />
        <rect x="330" y="208" width="14" height="14" rx="4" fill={TEAL} />
        <rect x="352" y="208" width="14" height="14" rx="4" fill={AMBER} />
        <rect x="330" y="230" width="36" height="14" rx="4" fill={IVORY} opacity=".5" />
      </g>
    </svg>
  );
}

function ProductsArt() {
  return (
    <svg viewBox="0 0 420 320" className="sd-how-svg" aria-hidden="true" focusable="false">
      <path d="M24 284 H396" stroke={IVORY} strokeOpacity=".22" strokeWidth="2" strokeLinecap="round" data-draw />
      {/* Three product boxes */}
      <g data-float>
        <rect x="40" y="150" width="104" height="134" rx="16" fill={IVORY} opacity=".92" />
        <rect x="58" y="170" width="68" height="62" rx="10" fill={TEAL} opacity=".9" />
        <rect x="58" y="246" width="44" height="6" rx="3" fill={NAVY} opacity=".7" />
        <rect x="58" y="258" width="28" height="6" rx="3" fill={NAVY} opacity=".35" />
      </g>
      <g data-float data-float-delay>
        <rect x="158" y="118" width="104" height="166" rx="16" fill={IVORY} opacity=".92" />
        <rect x="176" y="138" width="68" height="84" rx="10" fill={AMBER} />
        <rect x="176" y="238" width="54" height="6" rx="3" fill={NAVY} opacity=".7" />
        <rect x="176" y="250" width="34" height="6" rx="3" fill={NAVY} opacity=".35" />
        {/* Variant dots */}
        <circle cx="182" cy="270" r="4" fill={TEAL} />
        <circle cx="196" cy="270" r="4" fill={AMBER} />
        <circle cx="210" cy="270" r="4" fill={NAVY} opacity=".5" />
      </g>
      <g data-float>
        <rect x="276" y="176" width="104" height="108" rx="16" fill={IVORY} opacity=".92" />
        <rect x="294" y="194" width="68" height="46" rx="10" fill={NAVY} opacity=".8" />
        <rect x="294" y="254" width="48" height="6" rx="3" fill={NAVY} opacity=".7" />
      </g>
      {/* Payment card floating above the shelf */}
      <g data-float data-float-delay>
        <rect x="228" y="30" width="160" height="98" rx="16" fill={TEAL} />
        <rect x="228" y="30" width="160" height="98" rx="16" fill="none" stroke={IVORY} strokeOpacity=".35" strokeWidth="2" />
        <rect x="246" y="52" width="30" height="22" rx="5" fill={AMBER} />
        <rect x="246" y="92" width="64" height="7" rx="3.5" fill={IVORY} opacity=".85" />
        <rect x="318" y="92" width="26" height="7" rx="3.5" fill={IVORY} opacity=".5" />
        <circle cx="352" cy="60" r="11" fill={IVORY} opacity=".9" />
        <circle cx="366" cy="60" r="11" fill={AMBER} opacity=".9" />
      </g>
      {/* Link between card and shelf: payouts flow */}
      <path d="M300 128 C300 160 240 150 236 176" fill="none" stroke={IVORY} strokeOpacity=".4" strokeWidth="2" strokeDasharray="4 8" strokeLinecap="round" />
    </svg>
  );
}

function GlobeArt() {
  return (
    <svg viewBox="0 0 420 320" className="sd-how-svg" aria-hidden="true" focusable="false">
      <path d="M24 284 H396" stroke={IVORY} strokeOpacity=".22" strokeWidth="2" strokeLinecap="round" data-draw />
      {/* Globe */}
      <g data-float>
        <circle cx="190" cy="168" r="104" fill={NAVY} opacity=".5" stroke={IVORY} strokeWidth="3" />
        <ellipse cx="190" cy="168" rx="44" ry="104" fill="none" stroke={IVORY} strokeOpacity=".55" strokeWidth="2" data-draw />
        <ellipse cx="190" cy="168" rx="80" ry="104" fill="none" stroke={IVORY} strokeOpacity=".3" strokeWidth="2" data-draw />
        <path d="M86 168 H294" stroke={IVORY} strokeOpacity=".55" strokeWidth="2" data-draw />
        <path d="M100 118 H280" stroke={IVORY} strokeOpacity=".3" strokeWidth="2" data-draw />
        <path d="M100 218 H280" stroke={IVORY} strokeOpacity=".3" strokeWidth="2" data-draw />
        {/* Market dots */}
        <circle cx="148" cy="128" r="6" fill={TEAL} />
        <circle cx="236" cy="150" r="6" fill={AMBER} />
        <circle cx="206" cy="222" r="6" fill={TEAL} />
      </g>
      {/* Domain pin */}
      <g data-float data-float-delay>
        <path d="M312 86 C286 86 266 106 266 132 C266 168 312 212 312 212 C312 212 358 168 358 132 C358 106 338 86 312 86 Z" fill={TEAL} />
        <path d="M312 86 C286 86 266 106 266 132 C266 168 312 212 312 212 C312 212 358 168 358 132 C358 106 338 86 312 86 Z" fill="none" stroke={IVORY} strokeOpacity=".4" strokeWidth="2" />
        <circle cx="312" cy="132" r="18" fill={IVORY} />
        <circle cx="312" cy="132" r="8" fill={AMBER} />
      </g>
      <ellipse cx="312" cy="220" rx="26" ry="6" fill={TEAL} opacity=".3" />
      {/* Address bar chip */}
      <g data-float>
        <rect x="46" y="34" width="150" height="34" rx="17" fill={IVORY} opacity=".92" />
        <circle cx="66" cy="51" r="6" fill={TEAL} />
        <rect x="80" y="47" width="92" height="8" rx="4" fill={NAVY} opacity=".7" />
      </g>
      <path d="M120 68 C130 100 150 92 164 110" fill="none" stroke={IVORY} strokeOpacity=".4" strokeWidth="2" strokeDasharray="4 8" strokeLinecap="round" />
    </svg>
  );
}

export function HowArt({ art }: { art: HowArtKey }) {
  if (art === 's1') return <DoorArt />;
  if (art === 's2') return <ProductsArt />;
  return <GlobeArt />;
}
