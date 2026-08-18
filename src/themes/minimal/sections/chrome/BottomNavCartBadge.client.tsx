'use client';

// Live item-count badge for the mobile bottom nav's cart tab.
//
// The nav itself is a server component (pure links, no JS), so the count —
// which only exists in the client-side cart context — is isolated here. Renders
// nothing until there is something in the cart, so an empty cart looks exactly
// as it did before.

import { useCart } from '@/hooks/useCart';

export function BottomNavCartBadge({ accent }: { accent: string }) {
  const { itemCount } = useCart();
  if (itemCount <= 0) return null;

  return (
    <span
      className="absolute top-0 inset-s-1/2 ms-1 min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[9px] font-bold rounded-full text-white leading-none"
      style={{ backgroundColor: accent }}
      aria-hidden="true"
    >
      {itemCount > 99 ? '99+' : itemCount}
    </span>
  );
}
