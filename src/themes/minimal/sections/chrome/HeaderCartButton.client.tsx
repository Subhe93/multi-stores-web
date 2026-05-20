'use client';

// The header's cart trigger. Two creator-chosen modes:
//   • 'page'  → a plain link to the cart page.
//   • 'popup' → opens the slide-in CartDrawer in place (no navigation).
// Both show a live item-count badge from the cart hook.
//
// The CartDrawer is mounted lazily (only once the popup is first opened) so
// its next-intl `useTranslations` call never runs in environments without an
// intl provider until actually needed.

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { CartDrawer } from '@/components/cart/CartDrawer';

interface HeaderCartButtonProps {
  mode: 'page' | 'popup';
  href: string;
  ariaLabel: string;
  /** Badge background colour (header accent). */
  accent: string;
}

export function HeaderCartButton({ mode, href, ariaLabel, accent }: HeaderCartButtonProps) {
  const { itemCount } = useCart();
  const [open, setOpen] = useState(false);
  // Track whether the drawer has ever been opened so we can keep it mounted
  // afterwards (preserves its close animation) without mounting it up front.
  const [mounted, setMounted] = useState(false);

  const badge =
    itemCount > 0 ? (
      <span
        className="absolute -top-0.5 -end-0.5 min-w-[16px] h-[16px] px-1 flex items-center justify-center text-[9px] font-bold rounded-full text-white leading-none"
        style={{ backgroundColor: accent }}
      >
        {itemCount > 99 ? '99+' : itemCount}
      </span>
    ) : null;

  if (mode === 'page') {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        className="size-9 inline-flex items-center justify-center rounded-md hover:bg-black/5 transition relative"
      >
        <ShoppingBag className="size-4" />
        {badge}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
        className="size-9 inline-flex items-center justify-center rounded-md hover:bg-black/5 transition relative"
      >
        <ShoppingBag className="size-4" />
        {badge}
      </button>
      {mounted && <CartDrawer isOpen={open} onClose={() => setOpen(false)} />}
    </>
  );
}
