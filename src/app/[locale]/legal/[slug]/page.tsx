import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { legal, LEGAL_SLUGS, type LegalSlug } from '@/lib/api';
import { buildPlatformAlternates, localePath } from '@/lib/locale-path';
import { getPlatformName } from '@/lib/platform';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { Eyebrow } from '@/components/marketing/ui/Eyebrow';
import { Reveal } from '@/components/marketing/ui/Reveal';
import { routeSlug } from '@/lib/slugRoute';

// Platform legal pages (Privacy / Terms / Refund / Shipping). Rendered on the
// marketing site under /{locale}/legal/{slug}. The API supplies a localized
// title + admin-curated HTML, with sensible fallbacks to en/any-available.

interface LegalPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

function isKnownSlug(slug: string): slug is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(slug);
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  // Decoded once here; `legal.get` encodes it once (no double encoding).
  const slug = routeSlug(rawSlug);
  if (!isKnownSlug(slug)) return {};
  try {
    const [page, platformName] = await Promise.all([
      legal.get(slug, locale),
      getPlatformName(),
    ]);
    return {
      title: page.title,
      description: `${page.title} — ${platformName}`,
      alternates: buildPlatformAlternates(`/legal/${slug}`, locale),
    };
  } catch {
    return {};
  }
}

export default async function PlatformLegalPage({ params }: LegalPageProps) {
  const { locale, slug: rawSlug } = await params;
  // Decoded once here; `legal.get` encodes it once (no double encoding).
  const slug = routeSlug(rawSlug);
  if (!isKnownSlug(slug)) notFound();

  let page;
  try {
    page = await legal.get(slug, locale);
  } catch {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'home' });
  const updated = new Date(page.updated_at);
  const updatedLabel = Number.isNaN(updated.getTime())
    ? null
    : new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(updated);

  return (
    <MarketingShell locale={locale} solidHeader>
      {/* Top padding clears the fixed 72px header. */}
      <section className="sd-section sd-legal" style={{ paddingTop: 'calc(72px + clamp(40px, 6vw, 80px))' }}>
        <div className="sd-container sd-legal-container">
          <Reveal className="sd-legal-head">
            <Eyebrow>{t('footer.legal')}</Eyebrow>
            <h1 className="sd-h2 sd-legal-title">{page.title}</h1>
            {updatedLabel && (
              <p className="sd-legal-updated">
                <time dateTime={updated.toISOString()}>{updatedLabel}</time>
              </p>
            )}
          </Reveal>
          <Reveal className="sd-card sd-legal-card" delay={0.1}>
            <div className="sd-prose" dangerouslySetInnerHTML={{ __html: page.content }} />
          </Reveal>
          <Reveal className="sd-legal-foot" delay={0.15}>
            <Link href={localePath('/company', locale)} className="sd-link">{t('footer.companyInfo')}</Link>
          </Reveal>
        </div>
      </section>

      <style>{`
        .sd-legal-container { max-width: 880px; display: flex; flex-direction: column; gap: 32px; }
        .sd-legal-head { display: flex; flex-direction: column; gap: 18px; align-items: flex-start; }
        .sd-legal-title { max-width: 18ch; }
        .sd-legal-updated { font-size: 0.9rem; color: var(--sd-muted); }
        .sd-legal-card { padding: clamp(24px, 4vw, 48px); }
        .sd-legal-card:hover { transform: none; box-shadow: none; border-color: var(--sd-line); }
        .sd-legal-foot { font-weight: 600; color: var(--sd-teal-deep); }
      `}</style>
    </MarketingShell>
  );
}
