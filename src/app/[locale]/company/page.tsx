import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buildPlatformAlternates, localePath } from '@/lib/locale-path';
import { getPlatformName } from '@/lib/platform';
import { legal, LEGAL_SLUGS, type LegalPageSummary } from '@/lib/api';
import { COMPANY, CONTACT_EMAIL } from '@/lib/brand';
import { MarketingShell } from '@/components/marketing/MarketingShell';
import { Eyebrow } from '@/components/marketing/ui/Eyebrow';
import { Reveal } from '@/components/marketing/ui/Reveal';
import { SplitReveal } from '@/components/marketing/ui/SplitReveal';

// Company information page: the legal entity behind ShopsDoor (Namez AB), its
// public identifiers and its role towards sellers, plus links to the legal
// documents. Values that are not public yet are hidden (empty env values).

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'company' });
  const platformName = await getPlatformName();
  return {
    title: t('meta.title', { name: platformName }),
    description: t('meta.description'),
    alternates: buildPlatformAlternates('/company', locale),
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'company' });

  // Legal pages are admin-managed; the list is optional decoration here, so a
  // failing API must never break the page.
  let legalPages: LegalPageSummary[] = [];
  try {
    const all = await legal.list(locale);
    const bySlug = new Map(all.map((p) => [p.slug, p] as const));
    legalPages = LEGAL_SLUGS.map((slug) => bySlug.get(slug)).filter((p): p is LegalPageSummary => !!p);
  } catch {
    legalPages = [];
  }

  // Rows render in this order; a row with an empty value is skipped.
  const rows: { key: string; label: string; value: string; ltr?: boolean; href?: string }[] = [
    { key: 'legalEntity', label: t('legalEntity'), value: COMPANY.legalName },
    { key: 'orgNumber', label: t('orgNumber'), value: COMPANY.orgNumber, ltr: true },
    { key: 'vatNumber', label: t('vatNumber'), value: COMPANY.vatNumber, ltr: true },
    { key: 'address', label: t('address'), value: COMPANY.address },
    { key: 'country', label: t('country'), value: COMPANY.country },
    { key: 'email', label: t('email'), value: CONTACT_EMAIL, ltr: true, href: `mailto:${CONTACT_EMAIL}` },
    { key: 'platform', label: t('platform'), value: t('platformValue') },
  ].filter((row) => row.value.trim().length > 0);

  return (
    <MarketingShell locale={locale} solidHeader>
      {/* Top padding clears the fixed 72px header. */}
      <section className="sd-section sd-company" style={{ paddingTop: 'calc(72px + clamp(48px, 7vw, 96px))' }}>
        <div className="sd-pattern sd-company-pattern" aria-hidden="true" />
        <div className="sd-container sd-company-grid">
          <header className="sd-company-head">
            <Reveal y={16} duration={0.9}>
              <Eyebrow>{t('eyebrow')}</Eyebrow>
            </Reveal>
            <SplitReveal as="h1" className="sd-h2 sd-company-title" type="lines" locale={locale}>
              {t('title')}
            </SplitReveal>
            <Reveal y={24} delay={0.15}>
              <p className="sd-lead">{t('lead')}</p>
            </Reveal>
          </header>

          <div className="sd-company-body">
            <Reveal className="sd-card sd-company-card">
              <dl className="sd-company-dl">
                {rows.map((row) => (
                  <div key={row.key} className="sd-company-row">
                    <dt>{row.label}</dt>
                    <dd dir={row.ltr ? 'ltr' : undefined}>
                      {row.href ? (
                        <a href={row.href} className="sd-link">{row.value}</a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal className="sd-company-role" delay={0.1}>
              <h2 className="sd-h3">{t('roleTitle')}</h2>
              <p>{t('roleText')}</p>
            </Reveal>

            <Reveal className="sd-company-links" delay={0.15}>
              {legalPages.length > 0 && (
                <>
                  <h2 className="sd-company-links-head">{t('legalLinks')}</h2>
                  <ul>
                    {legalPages.map((page) => (
                      <li key={page.slug}>
                        <Link href={localePath(`/legal/${page.slug}`, locale)} className="sd-link">{page.title}</Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <Link href={localePath('/', locale)} className="sd-btn sd-btn-secondary sd-company-back">
                <span className="sd-btn-label">{t('backHome')}</span>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      <style>{`
        .sd-company { overflow: hidden; }
        .sd-company-pattern { position: absolute; inset: 0; pointer-events: none; mask-image: linear-gradient(to bottom, rgba(0,0,0,.9), transparent 70%); }
        .sd-company-grid { position: relative; display: grid; grid-template-columns: 1fr; gap: clamp(40px, 6vw, 80px); }
        .sd-company-head { display: flex; flex-direction: column; gap: 20px; align-items: flex-start; text-align: start; }
        .sd-company-title { max-width: 16ch; }
        .sd-company-body { display: flex; flex-direction: column; gap: 32px; }
        .sd-company-card { padding: 8px 28px; }
        .sd-company-dl { margin: 0; }
        .sd-company-row { display: grid; grid-template-columns: 1fr; gap: 4px; padding-block: 18px; border-bottom: 1px solid var(--sd-line); }
        .sd-company-row:last-child { border-bottom: 0; }
        .sd-company-row dt { font-size: 0.74rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--sd-muted); }
        [lang="ar"] .sd-company-row dt { letter-spacing: 0.04em; }
        .sd-company-row dd { margin: 0; font-size: 1.05rem; font-weight: 600; color: var(--sd-navy); overflow-wrap: anywhere; }
        .sd-company-row dd a { color: var(--sd-teal-deep); }
        .sd-company-role { background: var(--sd-navy); color: var(--sd-ivory); border-radius: var(--sd-radius); padding: clamp(24px, 3vw, 36px); }
        .sd-company-role h2 { color: var(--sd-amber); margin-bottom: 12px; }
        .sd-company-role p { line-height: 1.7; color: rgba(247, 244, 236, 0.84); }
        .sd-company-links { display: flex; flex-direction: column; gap: 16px; align-items: flex-start; }
        .sd-company-links-head { font-size: 0.74rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--sd-teal-deep); }
        [lang="ar"] .sd-company-links-head { letter-spacing: 0.04em; }
        .sd-company-links ul { display: flex; flex-wrap: wrap; gap: 10px 24px; font-weight: 600; color: var(--sd-navy); }
        .sd-company-back { margin-top: 12px; }
        @media (min-width: 900px) {
          .sd-company-grid { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); align-items: start; }
          .sd-company-head { position: sticky; top: 104px; }
          .sd-company-row { grid-template-columns: minmax(180px, 1fr) 2fr; gap: 16px; align-items: baseline; }
        }
      `}</style>
    </MarketingShell>
  );
}
