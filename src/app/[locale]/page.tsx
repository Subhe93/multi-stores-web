import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildPlatformAlternates } from '@/lib/locale-path';
import { getPlatformName } from '@/lib/platform';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { Hero } from '@/components/marketing/sections/Hero';
import { DoorSequence } from '@/components/marketing/sections/DoorSequence';
import { Features } from '@/components/marketing/sections/Features';
import { Sell } from '@/components/marketing/sections/Sell';
import { HowItWorks } from '@/components/marketing/sections/HowItWorks';
import { Pricing } from '@/components/marketing/sections/Pricing';
import { Contact } from '@/components/marketing/sections/Contact';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  const alternates = buildPlatformAlternates('/', locale);
  const platformName = await getPlatformName();
  const title = t('meta.title', { name: platformName });
  const description = t('meta.description');

  return {
    title,
    description,
    alternates,
    openGraph: { title, description, type: 'website', url: alternates.canonical, images: ['/brand/og.png'] },
    twitter: { card: 'summary_large_image', title, description, images: ['/brand/og.png'] },
  };
}

// ShopsDoor landing page. One h1 (in the hero); every other section opens
// with an h2 so the outline stays flat and crawlable.
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <MarketingShell locale={locale}>
      <Hero locale={locale} />
      <DoorSequence locale={locale} />
      <Features locale={locale} />
      <Sell locale={locale} />
      <HowItWorks locale={locale} />
      <Pricing locale={locale} />
      <Contact locale={locale} />
    </MarketingShell>
  );
}
