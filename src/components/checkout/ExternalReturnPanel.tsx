'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { useCheckoutSettings } from '@/hooks/useCheckoutSettings';
import {
  AUTO_RETURN_SECONDS,
  buildExternalReturnUrl,
  externalSiteHost,
  resolveReturnLabel,
  resolveReturnMode,
} from '@/lib/externalReturn';
import { whenPurchaseSettled } from '@/lib/trackEvents';

interface ExternalReturnPanelProps {
  /** Shown to the shopper and substituted into `{order_number}`. */
  orderNumber: string | null | undefined;
  /** Order uuid: the auto-redirect waits for its Purchase tags (max 3 s). */
  orderId: string | null | undefined;
}

/**
 * "Back to <site>" after a placed order (headless booking P3, R-D2). Renders
 * nothing unless the store has an external site, so every other store's
 * confirmation page is unchanged. The caller mounts it only in final good
 * states (Kustom paid; Stripe succeeded / inline / COD). In `auto` mode an
 * 8 s countdown with a cancel button precedes the redirect.
 */
export function ExternalReturnPanel({ orderNumber, orderId }: ExternalReturnPanelProps) {
  const t = useTranslations();
  const locale = useLocale();
  const settings = useCheckoutSettings();
  const href = buildExternalReturnUrl(settings, orderNumber);
  const site = externalSiteHost(settings);
  const auto = resolveReturnMode(settings) === 'auto';
  const [secondsLeft, setSecondsLeft] = useState(AUTO_RETURN_SECONDS);
  const [cancelled, setCancelled] = useState(false);
  const leavingRef = useRef(false);
  const counting = Boolean(href) && auto && !cancelled;

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [counting]);

  useEffect(() => {
    if (!counting || secondsLeft > 0 || !href || leavingRef.current) return;
    leavingRef.current = true;
    let stopped = false;
    void whenPurchaseSettled(orderId).then(() => {
      if (!stopped) window.location.assign(href);
    });
    return () => {
      stopped = true;
      leavingRef.current = false;
    };
  }, [counting, secondsLeft, href, orderId]);

  if (!href || !site) return null;
  const label = resolveReturnLabel(settings, locale) || t('checkout.returnToSite', { site });

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-center">
      <a
        href={href}
        rel="noreferrer"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
      >
        {label}
        <ArrowRight className="w-4 h-4 rtl:rotate-180" />
      </a>
      {counting && (
        <div className="mt-3 text-sm text-gray-500">
          <p role="status" aria-live="polite">
            {t('checkout.redirectingToSite', { site, seconds: secondsLeft })}
          </p>
          <button
            type="button"
            onClick={() => setCancelled(true)}
            className="mt-1 font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
          >
            {t('checkout.stayOnPage')}
          </button>
        </div>
      )}
    </div>
  );
}
