'use client';

// ── Designer session: one draft per product page (M5.5, NPP parity) ───────
// The designer renders INLINE on the product page like namez.se's NPP plugin:
// the live canvas takes the gallery column and the form (photos → texts →
// CTA) takes the add-to-cart form's place. Canvas and form may live in
// different theme sections, so the session (draft, images, fonts, uploads,
// gestures) is owned by one lazily loaded host and shared through this
// context. This module is the light entry: it must not import the renderer,
// so a product page without a design template ships none of it; the heavy
// code (`./DesignerInline`) is one async chunk loaded only when a payload is
// present (`ssr: false`, the session needs the browser).

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useStoreApp } from '@/hooks/useStoreApps';
import { useStorePrimaryLocale } from '@/hooks/useStorePrimaryLocale';
import { readDesignerPayload, type DesignerPayload } from '@/lib/designer/api';
import { pickButtonText } from '@/lib/designer/storefront';
import type { DesignerFormProps, DesignerSession } from './DesignerInline';

/** Static facts of the page's designer: what the host needs to start the session. */
export interface DesignerConfig {
  payload: DesignerPayload;
  productId: string;
  locale: string;
  storeSlug: string;
  publish: (session: DesignerSession | null) => void;
}

export interface DesignerContextValue extends DesignerConfig {
  /** Published by the host once its hooks ran; null while the chunk / session loads. */
  session: DesignerSession | null;
}

// Two contexts: the host writes the session and reads only the config, so a
// publish never re-renders the host itself (no update loop).
const ConfigContext = createContext<DesignerConfig | null>(null);
const SessionContext = createContext<DesignerSession | null>(null);

const SessionHost = dynamic(() => import('./DesignerInline').then((m) => m.DesignerSessionHost), { ssr: false });

/** The aspect box of the canvas (template ratio, e.g. 500:700): reserved before the chunk arrives, so nothing shifts. */
export function CanvasSkeleton() {
  const cfg = useContext(ConfigContext);
  const spec = cfg?.payload.spec_public;
  const ratio = spec ? spec.width / spec.height : 500 / 700;
  const t = useTranslations('designer');
  return (
    <div
      className="w-full animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none"
      style={{ aspectRatio: String(ratio) }}
      role="img"
      aria-label={t('loading')}
    />
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-3 animate-pulse motion-reduce:animate-none" aria-hidden="true">
      <div className="h-20 rounded-xl bg-gray-100" />
      <div className="h-11 rounded-lg bg-gray-100" />
      <div className="h-12 rounded-full bg-gray-100" />
    </div>
  );
}

const CanvasLazy = dynamic(() => import('./DesignerInline').then((m) => m.DesignerCanvasInline), {
  ssr: false,
  loading: () => <CanvasSkeleton />,
});
const FormLazy = dynamic<DesignerFormProps>(() => import('./DesignerInline').then((m) => m.DesignerFormInline), {
  ssr: false,
  loading: () => <FormSkeleton />,
});

export interface DesignerSessionProviderProps {
  /** The product's raw `designer` block (read through `readDesignerPayload`). */
  designer: unknown;
  productId: string;
  locale: string;
  children: ReactNode;
}

/**
 * Provides the designer session of a product page. Without an active app /
 * payload it renders the children untouched; nested under a provider of the
 * same product (ProductPageMagic inside a PRODUCT_TEMPLATE page) it reuses
 * the outer session instead of starting a second draft.
 */
export function DesignerSessionProvider({ designer, productId, locale, children }: DesignerSessionProviderProps) {
  const outer = useContext(ConfigContext);
  const app = useStoreApp('designer');
  const params = useParams<{ storeSlug?: string }>();
  const storeSlug = typeof params?.storeSlug === 'string' ? params.storeSlug : '';
  const payload = useMemo(() => (app ? readDesignerPayload(designer) : null), [app, designer]);
  const [session, setSession] = useState<DesignerSession | null>(null);
  const config = useMemo<DesignerConfig | null>(
    () => (payload ? { payload, productId, locale, storeSlug, publish: setSession } : null),
    [payload, productId, locale, storeSlug],
  );
  // One stable element: a publish re-renders this provider, and a fresh
  // `<SessionHost />` element would re-render the host too (publish loop).
  // Keyed by product, so a client navigation to another product starts a
  // new session (draft, uploads, `?design=`) instead of editing the old one.
  const host = useMemo(() => <SessionHost key={productId} />, [productId]);
  if ((outer && outer.productId === productId) || !config) return <>{children}</>;
  return (
    <ConfigContext.Provider value={config}>
      <SessionContext.Provider value={session}>
        {host}
        {children}
      </SessionContext.Provider>
    </ConfigContext.Provider>
  );
}

/** The host's view: config only (never the session it publishes). */
export function useDesignerConfig(): DesignerConfig {
  const cfg = useContext(ConfigContext);
  if (!cfg) throw new Error('useDesignerConfig: no DesignerSessionProvider');
  return cfg;
}

/** The product page's designer context, or null when the product has no design template. */
export function useDesignerSession(): DesignerContextValue | null {
  const cfg = useContext(ConfigContext);
  const session = useContext(SessionContext);
  return useMemo(() => (cfg ? { ...cfg, session } : null), [cfg, session]);
}

/**
 * Heading of the inline form: the app's `shop_button_text` (the label NPP
 * showed on its button), else the translated default.
 */
export function useDesignerHeading(locale: string): string {
  const t = useTranslations('designer');
  const app = useStoreApp('designer');
  const primaryLocale = useStorePrimaryLocale();
  return pickButtonText(app?.settings?.shop_button_text, locale, primaryLocale) || t('cta');
}

/**
 * Per-unit total of the chosen designer add-ons (M5.5: double-sided, rain
 * cover, poster copies), added to the CTA total by the host page. 0 without
 * a designer session or add-ons. Display only: the server prices the line.
 */
export function useDesignerAddonsTotal(): number {
  const session = useContext(SessionContext);
  return session?.addonsTotal ?? 0;
}

/** The live canvas in the gallery column (lazy; the aspect box is reserved meanwhile). */
export function DesignerCanvasSlot({ className }: { className?: string }) {
  const cfg = useContext(ConfigContext);
  if (!cfg) return null;
  return (
    <div className={className}>
      <CanvasLazy />
    </div>
  );
}

/** The inline form (photos → texts → CTA) in the summary column (lazy). */
export function DesignerFormSlot(props: DesignerFormProps) {
  const cfg = useContext(ConfigContext);
  if (!cfg) return null;
  return <FormLazy {...props} />;
}
