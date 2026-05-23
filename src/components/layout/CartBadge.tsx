'use client';

import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCart } from '@/hooks/useCart';
import { CartDrawer } from '@/components/cart/CartDrawer';

export function CartBadge() {
  const t = useTranslations('common');
  const { itemCount } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label={t('cart')}
        className="relative flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        <ShoppingCart className="w-5 h-5" />
        {itemCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full text-white px-1 leading-none animate-in zoom-in duration-200"
            style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
          >
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </button>

      <CartDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
