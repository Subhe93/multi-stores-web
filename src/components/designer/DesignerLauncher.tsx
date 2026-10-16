'use client';

// ── Designer entry point (M4.2 §7.1) ──────────────────────────────────────
// The "Design" button shown instead of the personalization form on designer
// products. The editor itself is a lazy chunk (next/dynamic, ssr:false), so
// other products never download it; this file must not import the renderer
// (only types), or every product page chunk would carry it. Opens by itself
// on `?design=<id>` (edit from the cart) and resumes the product's unfinished
// draft otherwise. The browser Back button closes the editor (one history
// entry is pushed while it is open) and focus returns to the launcher.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Paintbrush } from 'lucide-react';
import { useStoreApp } from '@/hooks/useStoreApps';
import { useStorePrimaryLocale } from '@/hooks/useStorePrimaryLocale';
import { getDraftFor, type DesignerPayload } from '@/lib/designer/api';
import { pickButtonText } from '@/lib/designer/storefront';
import type { DesignedLine } from './DesignerEditor';

const DesignerEditor = dynamic(() => import('./DesignerEditor'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80">
      <Loader2 className="h-6 w-6 animate-spin text-gray-500" aria-hidden="true" />
    </div>
  ),
});

/** Query parameter that opens the editor on an existing design (cart "Edit design"). */
export const DESIGN_QUERY_PARAM = 'design';

export interface DesignerLauncherProps {
  payload: DesignerPayload;
  productId: string;
  locale: string;
  productTitle: string;
  priceLabel?: string;
  blockedReason?: string | null;
  /** Inline option picker for the review step while a variant is missing. */
  variantPicker?: ReactNode;
  onAddToCart: (line: DesignedLine) => Promise<void>;
  onDone?: (kind: 'added' | 'saved') => void;
  className?: string;
  style?: CSSProperties;
}

function readDesignParam(): string | null {
  if (typeof window === 'undefined') return null;
  const v = new URL(window.location.href).searchParams.get(DESIGN_QUERY_PARAM);
  return v && /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

/** Shop button label: the app's `shop_button_text` setting, else the default. */
export function useDesignerButtonText(locale: string): string {
  const t = useTranslations('designer');
  const app = useStoreApp('designer');
  const primaryLocale = useStorePrimaryLocale();
  return pickButtonText(app?.settings?.shop_button_text, locale, primaryLocale) || t('cta');
}

/** Removes `?design=` from the current history entry (a reload must not reopen it). */
function dropDesignParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(DESIGN_QUERY_PARAM)) return;
  url.searchParams.delete(DESIGN_QUERY_PARAM);
  window.history.replaceState(window.history.state, '', url.toString());
}

/** Marker of the history entry pushed while the editor is open. */
const HISTORY_MARK = '__designerOpen';

export function DesignerLauncher({
  payload,
  productId,
  locale,
  productTitle,
  priceLabel,
  blockedReason,
  variantPicker,
  onAddToCart,
  onDone,
  className,
  style,
}: DesignerLauncherProps) {
  const t = useTranslations('designer');
  const params = useParams<{ storeSlug?: string }>();
  const storeSlug = typeof params?.storeSlug === 'string' ? params.storeSlug : '';
  const label = useDesignerButtonText(locale);
  const [open, setOpen] = useState(false);
  const [designId, setDesignId] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // True while the history entry pushed on open is the current one.
  const pushedRef = useRef(false);

  // One history entry per open editor, so the browser Back button closes it.
  // Next's own state is kept on the entry (it restores the page on popstate).
  const pushEntry = useCallback(() => {
    if (pushedRef.current) return;
    try {
      window.history.pushState({ ...(window.history.state ?? {}), [HISTORY_MARK]: true }, '');
      pushedRef.current = true;
    } catch {
      pushedRef.current = false;
    }
  }, []);

  const openWith = useCallback(
    (id: string | null) => {
      // The design id is read; the entry the editor returns to stays clean.
      dropDesignParam();
      setDesignId(id);
      setOpen(true);
      pushEntry();
    },
    [pushEntry],
  );

  // Client-only reads (localStorage / URL) after hydration.
  useEffect(() => {
    const fromUrl = readDesignParam();
    const draft = getDraftFor(productId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
    setHasDraft(Boolean(draft));
    if (fromUrl) openWith(fromUrl);
  }, [productId, openWith]);

  const openEditor = useCallback(() => {
    openWith(readDesignParam() ?? getDraftFor(productId));
  }, [productId, openWith]);

  const finish = useCallback(() => {
    setOpen(false);
    setHasDraft(Boolean(getDraftFor(productId)));
    // Focus goes back to the button that opened the dialog.
    requestAnimationFrame(() => buttonRef.current?.focus());
  }, [productId]);

  // Closed from the editor (close button, Escape, added to cart): drop the
  // pushed entry too, so Back then leaves the page as usual.
  const close = useCallback(() => {
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
    finish();
  }, [finish]);

  // Browser Back while open: the pushed entry is already gone.
  useEffect(() => {
    if (!open) return;
    const onPop = () => {
      if (!pushedRef.current) return;
      pushedRef.current = false;
      finish();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [open, finish]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openEditor}
        aria-haspopup="dialog"
        className={
          className ??
          'flex flex-1 min-w-48 items-center justify-center gap-2.5 rounded-full py-3.5 text-sm font-semibold text-white transition hover:opacity-90 hover:shadow-lg active:scale-[0.98]'
        }
        style={style ?? { backgroundColor: 'var(--store-primary, #2563eb)' }}
      >
        <Paintbrush className="h-4 w-4" aria-hidden="true" />
        {hasDraft ? t('continueDesign') : label}
      </button>
      {open && (
        <DesignerEditor
          key={designId ?? 'new'}
          payload={payload}
          productId={productId}
          storeSlug={storeSlug}
          locale={locale}
          productTitle={productTitle}
          priceLabel={priceLabel}
          initialDesignId={designId}
          blockedReason={blockedReason}
          variantPicker={variantPicker}
          onClose={close}
          onAddToCart={onAddToCart}
          onDone={onDone}
        />
      )}
    </>
  );
}
