'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import { continueShoppingLink, resolveBackLabel } from '@/lib/externalReturn';
import { focusedBackUrl, readBackParam, readRememberedBack, rememberBack } from '@/lib/focusedBack';
import { focusedStorefront, type FocusedStorefront } from '@/lib/focusedStorefront';

// Client side of the focused storefront gate (src/lib/focusedStorefront.ts).
// The settings come from the StoreProviders context the store layout fills
// (already resolved for the request host), so the server render and the
// hydrated tree always agree. Outside a provider tree, and for every store
// without the flag, every hook here returns null (or its fallback).

/** The focused storefront of the current store, or null. */
export function useFocusedStorefront(): FocusedStorefront | null {
  return focusedStorefront(useCheckoutSettings());
}

// ── Remembered back path (src/lib/focusedBack.ts) ────────────────────────────
// A tiny external store over sessionStorage. The server snapshot is always
// null, so the server HTML and the first client render carry the site root;
// React switches to the remembered path right after hydration (only the
// `href` changes: no layout shift, no hydration mismatch).

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const serverSnapshot = () => null;

function useRememberedBackPath(siteHost: string | null): string | null {
  return useSyncExternalStore(subscribe, () => readRememberedBack(siteHost), serverSnapshot);
}

/**
 * Product page of a focused storefront: a valid `?back=<path>` of the URL
 * replaces the remembered back path of the tab. Without the parameter (or
 * with a refused value) the remembered one is kept. No-op for every other
 * store.
 */
export function useCaptureBackParam(): void {
  const siteHost = useFocusedStorefront()?.siteHost ?? null;
  useEffect(() => {
    if (!siteHost) return;
    const path = readBackParam(window.location.search);
    if (path && rememberBack(siteHost, path)) listeners.forEach((listener) => listener());
  }, [siteHost]);
}

export interface BackToSiteLink {
  /**
   * The page of the external site the buyer came from when the tab remembers
   * one (after mount only), else the site root.
   */
  href: string;
  rel: 'noreferrer';
  /** The merchant's `back_label` for the locale, else "Back to <host>". */
  label: string;
}

/** The "back to site" link of a focused storefront, or null. */
export function useBackToSite(): BackToSiteLink | null {
  const settings = useCheckoutSettings();
  const locale = useLocale();
  const t = useTranslations('checkout');
  const focus = focusedStorefront(settings);
  const remembered = useRememberedBackPath(focus?.siteHost ?? null);
  if (!focus) return null;
  return {
    href: (remembered && focusedBackUrl(focus.siteUrl, remembered)) || focus.siteUrl,
    rel: 'noreferrer',
    label: resolveBackLabel(settings, locale) || t('returnToSite', { site: focus.siteHost }),
  };
}

/**
 * Props of a "continue shopping" link. Focused storefront: the back link
 * (the remembered page of the external site, else its root). Every other
 * store: `continueShoppingLink` unchanged (the external site when the store
 * has one, else `fallback`).
 */
export function useContinueShoppingLink(fallback: string): { href: string; rel?: string } {
  const settings = useCheckoutSettings();
  const back = useBackToSite();
  if (back) return { href: back.href, rel: back.rel };
  return continueShoppingLink(settings, fallback);
}
