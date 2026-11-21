'use client';

import { useState } from 'react';
import { Globe } from 'lucide-react';

// Small flag image with a globe fallback (unknown locale or country, or a
// failed load). Shared by the chrome LocaleSwitcher and the region picker.
//
// Flags are never mirrored or cropped. The whole flag is drawn in its own
// proportions inside a fixed 24x16 slot (object-contain, so nothing moves
// while it loads): a 3:2 flag fills the slot, a 2:1 flag is 24x12, centred.
// No rounding and no ring on the box (they would clip or cover the artwork);
// the hairline is a drop shadow that follows the drawn flag, outside its
// pixels. No `rtl:` or scale class here or on any wrapper that holds a flag.
export function Flag({ url }: { url: string; label?: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <Globe className="size-4 shrink-0 opacity-70" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden
      width={24}
      height={16}
      decoding="async"
      onError={() => setFailed(true)}
      className="block h-4 w-6 shrink-0 object-contain [filter:drop-shadow(0_0_0.5px_rgb(0_0_0/0.45))]"
    />
  );
}
