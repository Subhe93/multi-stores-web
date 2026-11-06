import { notFound } from 'next/navigation';
import { manrope, alexandria } from '../fonts/brand';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { locales, isRtl } from '@/i18n/config';
import { StoreProviders } from '@/components/providers/StoreProviders';
import { buildOrganization, buildWebSite, ldJsonSafe } from '@/lib/jsonld';
import { getPlatformName } from '@/lib/platform';
import { COMPANY, CONTACT_EMAIL, HEX } from '@/lib/brand';
import { MotionShim } from '@/components/marketing/providers/MotionShim';

// Brand typography for every platform page (landing, company, legal, auth).
// Manrope has no Arabic glyphs, so Alexandria (a geometric Arabic face whose
// heavy weights match Manrope's headlines) takes over via the
// `--font-arabic-ui` variable when the page is Arabic (see globals.css).
// Both are self-hosted in ../fonts/brand.ts.

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!(locales as readonly string[]).includes(locale)) {
    notFound();
  }

  const messages = await getMessages();
  const origin = (process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003').replace(/\/$/, '');
  // Platform-level Organization + WebSite JSON-LD, embedded once at the locale
  // layer so every marketing page (landing, legal, auth) inherits them.
  const platformName = await getPlatformName();
  const organizationLd = {
    ...buildOrganization({ name: platformName, url: origin, logo: `${origin}/brand/app-icon.svg`, email: CONTACT_EMAIL }),
    legalName: COMPANY.legalName,
    address: { '@type': 'PostalAddress', addressCountry: COMPANY.countryCode, ...(COMPANY.address ? { streetAddress: COMPANY.address } : {}) },
    ...(COMPANY.vatNumber ? { vatID: COMPANY.vatNumber } : {}),
    brand: { '@type': 'Brand', name: platformName, slogan: 'Many stores. One door.' },
  };
  const websiteLd = buildWebSite({ name: platformName, url: origin });

  return (
    <div
      dir={isRtl(locale) ? 'rtl' : 'ltr'}
      lang={locale}
      className={`${manrope.variable} ${alexandria.variable}`}
      style={{ '--sd-theme-color': HEX.navy } as React.CSSProperties}
    >
      <MotionShim />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJsonSafe(organizationLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJsonSafe(websiteLd) }}
      />
      <NextIntlClientProvider messages={messages}>
        <StoreProviders locale={locale}>
          {children}
        </StoreProviders>
      </NextIntlClientProvider>
    </div>
  );
}
