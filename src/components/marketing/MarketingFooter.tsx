import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { localePath } from '@/lib/locale-path';
import { legal, LEGAL_SLUGS, type LegalPageSummary } from '@/lib/api';

// Shared marketing-site footer used by the [locale] landing page and the
// platform legal pages. Fetches the localized legal-page list itself (soft
// fails so a transient API hiccup never blanks the page).
export async function MarketingFooter({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  let legalPages: LegalPageSummary[] = [];
  try {
    const all = await legal.list(locale);
    const bySlug = new Map(all.map((p) => [p.slug, p] as const));
    legalPages = LEGAL_SLUGS
      .map((slug) => bySlug.get(slug))
      .filter((p): p is LegalPageSummary => !!p);
  } catch {
    legalPages = [];
  }

  return (
    <footer style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <span className="text-lg font-bold tracking-tight">
              Multi<span style={{ color: 'var(--text-brand)' }}>Stores</span>
            </span>
            <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
              {t('subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Link href={localePath('/auth/login', locale)} className="transition" style={{ color: 'inherit' }}>{tc('login')}</Link>
            <Link href={localePath('/auth/register', locale)} className="transition" style={{ color: 'inherit' }}>{tc('register')}</Link>
            {legalPages.map((page) => (
              <Link
                key={page.slug}
                href={localePath(`/legal/${page.slug}`, locale)}
                className="transition"
                style={{ color: 'inherit' }}
              >
                {page.title}
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-8 pt-8 text-center text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--footer-muted)' }}>
          &copy; {new Date().getFullYear()} MultiStores. {tc('allRightsReserved')}
        </div>
      </div>
    </footer>
  );
}
