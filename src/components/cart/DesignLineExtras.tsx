'use client';

// ── Designer app (M4.2): the design part of a cart line ───────────────────
// "Edit design" link, the "start again from this design" action of an
// ordered (locked) design and the invalid-design message. Shared by the cart
// drawer line and the cart page row.

import { useTranslations } from 'next-intl';
import { Loader2, Pencil, RefreshCw } from 'lucide-react';
import type { CartLineDesign } from '@/hooks/useCart';
import type { useCartDesign } from '@/components/designer/useCartDesign';
import { useApiError } from '@/lib/useApiError';

interface Props {
  design: CartLineDesign | undefined;
  info: ReturnType<typeof useCartDesign>;
  /** Markets app: an unavailable line offers no design actions. */
  unavailable?: boolean;
}

/** Message of a design the server flagged invalid ('' when it is not). */
export function useDesignInvalidMessage(design: CartLineDesign | undefined): string {
  const t = useTranslations();
  if (design?.invalid !== true) return '';
  const code = design.invalidCode;
  return code && t.has(`errors.${code}`) ? t(`errors.${code}`) : t('personalization.invalidLine');
}

export function DesignLineExtras({ design, info, unavailable = false }: Props) {
  const t = useTranslations();
  const apiError = useApiError();
  const invalidMessage = useDesignInvalidMessage(design);
  if (!design || unavailable) return null;
  return (
    <>
      {info.editHref && (
        <a
          href={info.editHref}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
          style={{ color: 'var(--theme-colors-link, var(--theme-colors-price, var(--store-primary, #2563eb)))' }}
        >
          <Pencil className="w-3 h-3" aria-hidden="true" />
          {t('designer.editDesign')}
        </a>
      )}
      {/* An ordered design (e.g. after a failed payment) cannot change: the
          line moves to a copy of it, photos included. */}
      {info.locked ? (
        <div className="space-y-1">
          <p className="text-xs text-amber-700">{t('designer.lockedInCart')}</p>
          <button
            type="button"
            onClick={() => void info.startAgain()}
            disabled={info.restarting}
            className="inline-flex min-h-11 w-fit items-center gap-1 text-xs font-medium underline-offset-2 hover:underline disabled:opacity-50"
            style={{ color: 'var(--theme-colors-link, var(--theme-colors-price, var(--store-primary, #2563eb)))' }}
          >
            {info.restarting ? (
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-3 h-3" aria-hidden="true" />
            )}
            {t('designer.startAgain')}
          </button>
          {info.restartError != null && (
            <p className="text-xs text-red-600" role="alert">{apiError(info.restartError)}</p>
          )}
        </div>
      ) : invalidMessage ? (
        <p className="text-xs text-red-600">{invalidMessage}</p>
      ) : null}
    </>
  );
}
