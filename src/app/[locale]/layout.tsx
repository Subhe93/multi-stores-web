import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { locales, isRtl } from '@/i18n/config';
import { StoreProviders } from '@/components/providers/StoreProviders';
import { buildOrganization, buildWebSite, ldJsonSafe } from '@/lib/jsonld';

const PLATFORM_NAME = 'MultiStores';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();
  const origin = (process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3003').replace(/\/$/, '');
  // Platform-level Organization + WebSite JSON-LD, embedded once at the locale
  // layer so every marketing page (landing, legal, auth) inherits them.
  const organizationLd = buildOrganization({ name: PLATFORM_NAME, url: origin });
  const websiteLd = buildWebSite({ name: PLATFORM_NAME, url: origin });

  return (
    <div dir={isRtl(locale) ? 'rtl' : 'ltr'} lang={locale}>
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
