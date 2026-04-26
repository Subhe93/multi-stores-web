import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { locales, isRtl } from '@/i18n/config';
import { StoreProviders } from '@/components/providers/StoreProviders';

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

  return (
    <div dir={isRtl(locale) ? 'rtl' : 'ltr'} lang={locale}>
      <NextIntlClientProvider messages={messages}>
        <StoreProviders>
          {children}
        </StoreProviders>
      </NextIntlClientProvider>
    </div>
  );
}
