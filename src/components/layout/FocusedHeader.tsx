'use client';

import Link from 'next/link';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCart } from '@/hooks/useCart';
import { useBackToSite } from '@/hooks/useFocusedStorefront';
import { useLocalePath } from '@/hooks/useLocalePath';
import { resolveMediaUrl } from '@/lib/api';
import { responsiveImgProps } from '@/lib/storeMedia';

interface FocusedHeaderProps {
  storeName: string;
  logoUrl?: string;
  primaryColor?: string;
  logoSize?: number;
}

/**
 * Header of a focused storefront (src/lib/focusedStorefront.ts): the store
 * logo linking to the external site, a "back to site" link and the cart with
 * its count. Nothing else: no menu, collections, search, switchers, account
 * link or announcement bar. The store layout renders it INSTEAD of the
 * built-in header and of a published builder HEADER page.
 *
 * The cart is a plain link to the cart page (no drawer: the drawer offers
 * browsing). The count starts at 0 on the server and in the first client
 * render (the cart loads after mount), like the regular cart badge.
 */
export function FocusedHeader({ storeName, logoUrl, primaryColor, logoSize = 32 }: FocusedHeaderProps) {
  const t = useTranslations('common');
  const lp = useLocalePath();
  const back = useBackToSite();
  const { itemCount } = useCart();
  // The layout only renders this header in focused mode; without the link
  // (should not happen) nothing is shown rather than a header without exit.
  if (!back) return null;

  return (
    <header className="store-surface store-bd border-b" data-focused-header="">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <a
          href={back.href}
          rel={back.rel}
          // The logo image keeps its size (the back link's text truncates
          // instead); a text-only brand may shrink and truncate itself.
          className={`flex items-center gap-2.5 hover:opacity-80 transition-opacity ${logoUrl ? 'shrink-0' : 'min-w-0'}`}
          data-focused-logo=""
        >
          {logoUrl ? (
            <img
              {...responsiveImgProps(resolveMediaUrl(logoUrl), `${logoSize * 5}px`)}
              alt={storeName}
              height={logoSize}
              style={{ height: logoSize, width: 'auto' }}
              // A wide logo may not push the back link and the cart off a phone screen.
              className="object-contain rounded max-w-[38vw] sm:max-w-none"
            />
          ) : (
            <>
              <span
                className="w-9 h-9 shrink-0 rounded-lg flex items-center justify-center font-bold text-sm"
                style={{
                  backgroundColor: primaryColor || 'var(--store-primary, #2563eb)',
                  color: 'var(--store-primary-contrast, #fff)',
                }}
              >
                {storeName.charAt(0).toUpperCase()}
              </span>
              <span className="font-semibold text-gray-900 text-base truncate">{storeName}</span>
            </>
          )}
        </a>

        <div className="flex items-center gap-1 sm:gap-3 min-w-0">
          <a
            href={back.href}
            rel={back.rel}
            className="inline-flex items-center gap-1.5 min-w-0 min-h-11 px-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            data-focused-back=""
          >
            {/* Points against the reading direction (flipped in RTL). */}
            <ArrowLeft className="w-4 h-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
            <span className="truncate max-w-[30vw] sm:max-w-xs">{back.label}</span>
          </a>
          <Link
            prefetch={false}
            href={lp('/cart')}
            aria-label={t('cart')}
            className="relative flex items-center justify-center shrink-0 w-11 h-11 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            data-focused-cart=""
          >
            <ShoppingCart className="w-5 h-5" aria-hidden="true" />
            {itemCount > 0 && (
              <span
                className="absolute top-0.5 end-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full px-1 leading-none"
                style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
              >
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
