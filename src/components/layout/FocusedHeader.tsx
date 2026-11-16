'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Check, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCart } from '@/hooks/useCart';
import { useBackToSite } from '@/hooks/useFocusedStorefront';
import { useLocalePath } from '@/hooks/useLocalePath';
import { resolveMediaUrl } from '@/lib/api';
import { FOCUSED_STEPS, focusedStep, type FocusedStep } from '@/lib/focusedStorefront';
import { responsiveImgProps } from '@/lib/storeMedia';

interface FocusedHeaderProps {
  storeName: string;
  logoUrl?: string;
  primaryColor?: string;
  /** Kept for the callers; the focused header caps the logo itself. */
  logoSize?: number;
}

/** Same frame as the theme's page container, so the bar lines up with the content. */
export const FOCUSED_CONTAINER_CLASS = 'mx-auto w-full px-4 sm:px-6 lg:px-8';
export const FOCUSED_CONTAINER_STYLE: CSSProperties = { maxWidth: 'var(--theme-container-max, 1200px)' };

const STEP_LABEL_KEYS: Record<FocusedStep, 'stepDetails' | 'stepCart' | 'stepPayment'> = {
  details: 'stepDetails',
  cart: 'stepCart',
  payment: 'stepPayment',
};

/**
 * Slim step indicator of a focused storefront: "1 Your details · 2 Cart ·
 * 3 Payment" with the current step highlighted. Renders nothing on a page
 * that is not a step (legal pages, order confirmation, 404).
 */
export function FocusedSteps() {
  const t = useTranslations('focused');
  const current = focusedStep(usePathname());
  if (!current) return null;
  const currentIndex = FOCUSED_STEPS.indexOf(current);

  return (
    <div
      className="border-b"
      style={{ borderColor: 'var(--theme-colors-border, #e5e7eb)', backgroundColor: 'var(--theme-colors-background, #fff)' }}
      data-focused-steps=""
    >
      <ol
        aria-label={t('stepsLabel')}
        className={`${FOCUSED_CONTAINER_CLASS} flex h-11 items-center gap-2 text-xs font-medium sm:gap-3 sm:text-[13px]`}
        style={FOCUSED_CONTAINER_STYLE}
      >
        {FOCUSED_STEPS.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = index < currentIndex;
          return (
            <li
              key={step}
              aria-current={isCurrent ? 'step' : undefined}
              data-step={step}
              data-step-state={isCurrent ? 'current' : isDone ? 'done' : 'upcoming'}
              className="flex min-w-0 items-center gap-2 sm:gap-3"
              style={{ color: isCurrent ? 'var(--theme-colors-text, #111827)' : 'var(--theme-colors-muted, #6b7280)' }}
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="h-px w-4 shrink-0 sm:w-8"
                  style={{ backgroundColor: 'var(--theme-colors-border, #d1d5db)' }}
                />
              )}
              <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none"
                  style={
                    isCurrent
                      ? { backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }
                      : {
                          border: '1px solid',
                          borderColor: isDone ? 'var(--store-primary, #2563eb)' : 'var(--theme-colors-border, #d1d5db)',
                          color: isDone ? 'var(--store-primary, #2563eb)' : 'inherit',
                        }
                  }
                >
                  {isDone ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : index + 1}
                </span>
                {/* On a very narrow phone only the current step keeps its
                    label visible (the others stay readable to screen readers),
                    so no label is ever cut mid-word. */}
                <span className={isCurrent ? 'whitespace-nowrap' : 'sr-only whitespace-nowrap min-[380px]:not-sr-only'}>
                  {t(STEP_LABEL_KEYS[step])}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Header of a focused storefront (src/lib/focusedStorefront.ts): the store
 * logo linking to the external site, a "back to site" link and the cart with
 * its count, then the purchase step indicator on the product, cart and
 * checkout pages. Nothing else: no menu, collections, search, switchers,
 * account link or announcement bar. The store layout renders it INSTEAD of
 * the built-in header and of a published builder HEADER page; the checkout
 * layout renders it instead of its own minimal header.
 *
 * The logo and the back link lead to the site page the buyer came from when
 * the tab remembers one (`?back=`, src/lib/focusedBack.ts), else to the site
 * root; the server always renders the site root.
 *
 * The cart is a plain link to the cart page (no drawer: the drawer offers
 * browsing). The count starts at 0 on the server and in the first client
 * render (the cart loads after mount), like the regular cart badge.
 */
export function FocusedHeader({ storeName, logoUrl, primaryColor }: FocusedHeaderProps) {
  const t = useTranslations('common');
  const tf = useTranslations('focused');
  const lp = useLocalePath();
  const back = useBackToSite();
  const { itemCount } = useCart();
  // The layout only renders this header in focused mode; without the link
  // (should not happen) nothing is shown rather than a header without exit.
  if (!back) return null;

  const actionClass =
    'inline-flex min-h-11 items-center justify-center rounded-full transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--store-primary,#2563eb)]';

  return (
    <header data-focused-header="" style={{ backgroundColor: 'var(--theme-colors-background, #fff)', color: 'var(--theme-colors-text, #111827)' }}>
      <div className="border-b" style={{ borderColor: 'var(--theme-colors-border, #e5e7eb)' }}>
        <div className={`${FOCUSED_CONTAINER_CLASS} flex h-15 items-center justify-between gap-3 md:h-18`} style={FOCUSED_CONTAINER_STYLE}>
          <a
            href={back.href}
            rel={back.rel}
            // The logo image keeps its (capped) size; a text-only brand may
            // shrink and truncate itself.
            className={`flex items-center gap-2.5 transition-opacity hover:opacity-80 ${logoUrl ? 'shrink-0' : 'min-w-0'}`}
            data-focused-logo=""
          >
            {logoUrl ? (
              <img
                {...responsiveImgProps(resolveMediaUrl(logoUrl), '200px')}
                alt={storeName}
                // Capped in both directions (about 200 x 34 on desktop), so a
                // wide logo never pushes the back link and the cart off a
                // phone screen and a tall one never grows the bar. The height is
                // explicit: an SVG without intrinsic size has no width otherwise.
                className="block h-7 w-auto max-w-[132px] object-contain object-left rtl:object-right min-[380px]:max-w-[150px] md:h-[34px] md:max-w-[200px]"
              />
            ) : (
              <>
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                  style={{
                    backgroundColor: primaryColor || 'var(--store-primary, #2563eb)',
                    color: 'var(--store-primary-contrast, #fff)',
                  }}
                >
                  {storeName.charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-base font-semibold">{storeName}</span>
              </>
            )}
          </a>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <a
              href={back.href}
              rel={back.rel}
              // The full label is the accessible name on every screen size:
              // phones show a short text (or only the arrow under 380px).
              aria-label={back.label}
              className={`${actionClass} gap-1.5 px-3 text-sm font-medium`}
              style={{ color: 'var(--theme-colors-text, #111827)' }}
              data-focused-back=""
            >
              {/* Points against the reading direction (flipped in RTL). */}
              <ArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden="true" />
              <span className="hidden whitespace-nowrap lg:inline">{back.label}</span>
              <span className="hidden whitespace-nowrap min-[380px]:inline lg:hidden" data-focused-back-short="">
                {tf('backShort')}
              </span>
            </a>
            <Link
              prefetch={false}
              href={lp('/cart')}
              aria-label={t('cart')}
              className={`${actionClass} relative w-11 shrink-0`}
              style={{ color: 'var(--theme-colors-text, #111827)' }}
              data-focused-cart=""
            >
              <ShoppingCart className="size-5" aria-hidden="true" />
              {itemCount > 0 && (
                <span
                  className="absolute end-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
                  style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
      <FocusedSteps />
    </header>
  );
}
