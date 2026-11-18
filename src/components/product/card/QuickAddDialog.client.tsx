'use client';

// Quick-add dialog of a product card. OWNER: builder W4.
//
// Reads the product from the product endpoint (same payload, locale and
// market as the product page) and mounts the product page state around the
// page's own variant picker and add-to-cart button, so variants, stock, the
// cart's stock cap, the per-order limit and prices are the product page's:
// there is no second add-to-cart path. A product that needs more than a
// variant (personalization, designer, custom fields, customer upload,
// bundles) shows only a link to its page.
//
// Native <dialog> opened with showModal(): the browser traps focus, closes
// on Escape and keeps the page inert. A Tab trap and an Escape handler cover
// engines without it. The dialog is portalled to the store root so it keeps
// the theme variables and no card ancestor (slider, hover state) affects it.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Check, X } from 'lucide-react';
import { StoreImage } from '@/components/StoreImage';
import { PriceTaxSuffix } from '@/components/product/PriceTaxSuffix';
import type { ProductData } from '@/components/product/ProductDetailClient';
import {
  ProductPageStateProvider,
  useProductPageState,
} from '@/components/product/state/ProductPageState';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useMarket } from '@/hooks/useMarket';
import { useProductCardSettings, useProductCardStoreSlug } from '@/hooks/useProductCard';
import { useStorePrimaryLocale } from '@/hooks/useStorePrimaryLocale';
import { storefront } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { projectProductForClient } from '@/lib/productPayload';
import { isSvgSrc } from '@/lib/storeMedia';
import { StateAddToCartButton } from '@/themes/minimal/sections/product/blocks/ProductBuyBlock.client';
import { StateVariantSelector, hasMainVariantOptions } from '@/themes/minimal/sections/product/blocks/b1Shared';
import './quick-add.css';

export interface QuickAddDialogProps {
  /** The button that opened the dialog (the portal target is found from it). */
  anchor: HTMLElement | null;
  productSlug: string;
  title: string;
  /** Product page URL. */
  href: string;
  currency?: string;
  onClose: () => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; product: ProductData };

/**
 * True when the product needs more than a variant pick before it can go in
 * the cart: those are bought on the product page only.
 */
export function needsProductPage(product: ProductData): boolean {
  const p = product as ProductData & { bundles?: unknown[] | null };
  if (p.personalization?.enabled) return true;
  if (p.designer != null) return true;
  if (Array.isArray(p.custom_fields) && p.custom_fields.length > 0) return true;
  if (p.allow_customer_upload) return true;
  if (Array.isArray(p.bundles) && p.bundles.length > 0) return true;
  return false;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function QuickAddDialog({ anchor, productSlug, title, href, currency = 'EUR', onClose }: QuickAddDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const primaryLocale = useStorePrimaryLocale() ?? locale;
  const storeSlug = useProductCardStoreSlug();
  const market = useMarket();
  const marketKey = market?.key;
  const marketPreview = market?.preview === true;
  const settings = useProductCardSettings();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // ── Product read (one request per open, plus retries) ──
  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    if (!storeSlug) {
      setLoad({ status: 'error' });
      return;
    }
    const marketRef = marketKey ? (marketPreview ? { key: marketKey, preview: true as const } : { key: marketKey }) : undefined;
    storefront
      .getProduct(storeSlug, productSlug, locale, marketRef)
      .then((data) => {
        if (!alive) return;
        if (!data || typeof data !== 'object') {
          setLoad({ status: 'error' });
          return;
        }
        setLoad({
          status: 'ready',
          product: projectProductForClient(data as object, locale, primaryLocale) as unknown as ProductData,
        });
      })
      .catch(() => {
        if (alive) setLoad({ status: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [storeSlug, productSlug, locale, primaryLocale, marketKey, marketPreview, attempt]);

  // ── Open as a modal, lock the page scroll ──
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (typeof el.showModal === 'function') {
      try {
        if (!el.open) el.showModal();
      } catch {
        el.setAttribute('open', '');
      }
    } else {
      el.setAttribute('open', '');
    }
    closeRef.current?.focus();
    const root = document.documentElement;
    const gap = window.innerWidth - root.clientWidth;
    const prevOverflow = root.style.overflow;
    const prevPad = root.style.paddingInlineEnd;
    root.style.overflow = 'hidden';
    if (gap > 0) root.style.paddingInlineEnd = `${gap}px`;
    return () => {
      root.style.overflow = prevOverflow;
      root.style.paddingInlineEnd = prevPad;
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDialogElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const el = dialogRef.current;
      if (!el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !el.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  // A click on the backdrop lands on the dialog element itself.
  const handleBackdrop = useCallback(
    (e: MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const target = useMemo(
    () => (typeof document === 'undefined' ? null : (anchor?.closest<HTMLElement>('[data-theme]') ?? document.body)),
    [anchor],
  );
  if (!target) return null;

  const corners = settings?.corners === 'square' ? 'square' : 'theme';

  return createPortal(
    <dialog
      ref={dialogRef}
      className="qadd"
      data-corners={corners}
      data-quick-add-dialog=""
      aria-labelledby={titleId}
      aria-busy={load.status === 'loading' || undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={handleKeyDown}
      onClick={handleBackdrop}
    >
      <div className="qadd-panel">
        <button ref={closeRef} type="button" className="qadd-close" onClick={onClose} aria-label={t('common.close')}>
          <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </button>

        {load.status === 'ready' ? (
          <ProductPageStateProvider product={load.product} locale={locale} primaryLocale={primaryLocale} currency={currency}>
            <QuickAddBody titleId={titleId} fallbackTitle={title} href={href} onClose={onClose} />
          </ProductPageStateProvider>
        ) : (
          <>
            <div className="qadd-media" aria-hidden="true">
              {load.status === 'loading' ? <div className="qadd-skeleton qadd-skeleton-fill" /> : null}
            </div>
            <div className="qadd-content">
              <h2 id={titleId} className="qadd-title">
                {title}
              </h2>
              {load.status === 'loading' ? (
                <div className="qadd-skeleton-stack" aria-hidden="true">
                  <div className="qadd-skeleton" style={{ width: '30%', height: '1.25rem' }} />
                  <div className="qadd-skeleton" style={{ width: '70%', height: '2.75rem', marginTop: '1.25rem' }} />
                  <div className="qadd-skeleton" style={{ width: '100%', height: '3rem', marginTop: '1.25rem' }} />
                </div>
              ) : (
                <div className="qadd-error" role="alert">
                  <p>{t('product.quickAddLoadError')}</p>
                  <button type="button" className="qadd-ghost" onClick={() => setAttempt((n) => n + 1)}>
                    {t('product.quickAddRetry')}
                  </button>
                </div>
              )}
              <Link href={href} prefetch={false} className="qadd-details">
                {t('product.viewFullDetails')}
                <ArrowRight className="size-4 rtl:-scale-x-100" strokeWidth={1.5} aria-hidden="true" />
              </Link>
            </div>
          </>
        )}
      </div>
    </dialog>,
    target,
  );
}

function QuickAddBody({
  titleId,
  fallbackTitle,
  href,
  onClose,
}: {
  titleId: string;
  fallbackTitle: string;
  href: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const lp = useLocalePath();
  const state = useProductPageState();
  const { product, translation, galleryImages, currency, taxRateBp, display, currentPrice, comparePrice, addedToCart, optionSelections } = state;
  const linkOnly = needsProductPage(product);
  const title = translation?.title || fallbackTitle;
  const image = galleryImages[0];
  const fmt = (n: number) => formatPrice(display(n, taxRateBp, currency).amount, currency, state.locale);
  const onSale = comparePrice !== undefined && comparePrice > currentPrice;

  // The "added" line stays until the shopper picks something else (the
  // state's own flag drops after a few seconds).
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (addedToCart) setAdded(true);
  }, [addedToCart]);
  const picksKey = JSON.stringify(optionSelections);
  const firstPicks = useRef(picksKey);
  useEffect(() => {
    if (firstPicks.current !== picksKey) {
      firstPicks.current = picksKey;
      setAdded(false);
    }
  }, [picksKey]);

  return (
    <>
      <div className="qadd-media">
        {image ? (
          <StoreImage
            src={image.url}
            alt={image.alt || title}
            fill
            sizes="(max-width: 767px) 96px, 420px"
            unoptimized={isSvgSrc(image.url)}
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="qadd-content">
        {product.vendor?.company_name ? (
          <p className="qadd-vendor">{t('product.soldBy', { name: product.vendor.company_name })}</p>
        ) : null}
        <h2 id={titleId} className="qadd-title">
          {title}
        </h2>
        <p className="qadd-price">
          <span className="qadd-price-now" data-sale={onSale ? '' : undefined}>
            {fmt(currentPrice)}
          </span>
          {onSale ? <s className="qadd-price-was">{fmt(comparePrice)}</s> : null}
          <PriceTaxSuffix className="qadd-price-tax" taxRateBp={taxRateBp} />
        </p>

        {linkOnly ? (
          <Link href={href} prefetch={false} className="qadd-primary" data-quick-add-link-only="">
            {t('product.chooseOptions')}
            <ArrowRight className="size-4 rtl:-scale-x-100" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        ) : (
          <>
            {hasMainVariantOptions(state) ? (
              <div className="qadd-options">
                <StateVariantSelector state={state} />
              </div>
            ) : null}
            <div className="qadd-buy">
              <StateAddToCartButton state={state} buttonStyle="solid" className="w-full" />
            </div>
            {state.variantAttemptMessage ? (
              <p role="alert" className="qadd-alert">
                {state.variantAttemptMessage}
              </p>
            ) : null}
            {state.addToCartError ? (
              <p role="alert" className="qadd-alert">
                {state.addToCartError}
              </p>
            ) : null}
            <div role="status" className="qadd-added" data-on={added ? '' : undefined}>
              {added ? (
                <>
                  <span className="qadd-added-text">
                    <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                    {t('cart.itemAdded')}
                  </span>
                  <span className="qadd-added-actions">
                    <Link href={lp('/cart')} className="qadd-ghost">
                      {t('cart.viewCart')}
                    </Link>
                    <button type="button" className="qadd-text" onClick={onClose}>
                      {t('cart.continueShopping')}
                    </button>
                  </span>
                </>
              ) : null}
            </div>
          </>
        )}

        {linkOnly ? null : (
          <Link href={href} prefetch={false} className="qadd-details">
            {t('product.viewFullDetails')}
            <ArrowRight className="size-4 rtl:-scale-x-100" strokeWidth={1.5} aria-hidden="true" />
          </Link>
        )}
      </div>
    </>
  );
}
