import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { locales, type Locale } from '@/i18n/config';
import { SectionRenderer } from '@/themes/SectionRenderer';
import { minimalTheme } from '@/themes/minimal/theme';
import { tokensToCssVars } from '@/themes/tokens';
import { CreativeBoot } from '@/themes/creative/boot.client';
import { creativeDemoEnabled } from '@/themes/creative/demo/demoGate';
import { demoSections } from '@/themes/creative/demo/fixtures';
import { JsFlag } from '@/themes/creative/primitives/JsFlag';

// Demo page of the creative engine: every creative section with neutral
// fixture content, outside any store. Development only (or CREATIVE_DEMO=1),
// never linked, never indexed.
//
// Query: locale=en|ar|tr|de|fr|sv, only=<section key>, creative=1 (store
// switch with every option), motion=calm|off, builder=1 (builder preview
// state), and the engine's own cx-motion=force.

export const metadata: Metadata = {
  title: 'Creative engine demo',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface DemoProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] || '' : v || '');

export default async function CreativeDemoPage({ searchParams }: DemoProps) {
  if (!creativeDemoEnabled()) notFound();
  const query = await searchParams;

  const requested = one(query.locale);
  const locale: Locale = (locales as readonly string[]).includes(requested) ? (requested as Locale) : 'en';
  const only = one(query.only) || undefined;
  const creative = one(query.creative) === '1';
  const motion = one(query.motion);
  const builder = one(query.builder) === '1';

  const messages = (await import(`@/i18n/messages/${locale}.json`)).default;
  const sections = demoSections(only);

  const rootAttrs: Record<string, string> = {};
  if (motion === 'calm' || motion === 'off') rootAttrs['data-motion-reveal'] = motion;
  if (builder) rootAttrs['data-cx-builder'] = '';
  if (creative) {
    rootAttrs['data-creative'] = '';
    rootAttrs['data-creative-transition'] = 'curtain';
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        lang={locale}
        data-theme={minimalTheme.key}
        {...rootAttrs}
        className="store-root"
        style={
          {
            ...tokensToCssVars(minimalTheme.tokens),
            minHeight: '100vh',
            // Same frame as MinimalLayout: clip the 100vw full-bleed trick.
            overflowX: 'clip',
            backgroundColor: 'var(--theme-colors-background)',
            color: 'var(--theme-colors-text)',
            fontFamily: 'var(--theme-font-body)',
            lineHeight: 'var(--theme-line-body)',
          } as CSSProperties
        }
      >
        {creative && !builder && (
          <>
            <JsFlag />
            <CreativeBoot
              options={{ smooth: true, magnetic: true, curtain: true }}
              curtainLabel={messages.creative.loadingPage}
            />
          </>
        )}
        <main>
          <div style={{ maxWidth: 'var(--theme-container-max)', marginInline: 'auto', paddingInline: '1.5rem' }}>
            <SectionRenderer
              theme={minimalTheme}
              sections={sections}
              locale={locale}
              primaryLocale="en"
              storeSlug="creative-demo"
              builderPreview={builder || undefined}
            />
          </div>
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
