import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { localePath } from '@/lib/locale-path';
import { legal, LEGAL_SLUGS, type LegalPageSummary } from '@/lib/api';
import { CONTACT_EMAIL, NAV } from '@/lib/brand';
import { ShopsDoorLogo } from '@/components/brand/ShopsDoorLogo';
import { Reveal } from './ui/Reveal';

// Shared marketing footer: brand column with the operator line (Namez AB),
// product anchors, company links and the admin-managed legal pages.
export async function MarketingFooter({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const tc = await getTranslations({ locale, namespace: 'common' });
  const home = localePath('/', locale);

  let legalPages: LegalPageSummary[] = [];
  try {
    const all = await legal.list(locale);
    const bySlug = new Map(all.map((p) => [p.slug, p] as const));
    legalPages = LEGAL_SLUGS.map((slug) => bySlug.get(slug)).filter((p): p is LegalPageSummary => !!p);
  } catch {
    legalPages = [];
  }

  return (
    <footer className="sd-footer">
      <div className="sd-pattern sd-footer-pattern" aria-hidden="true" />
      <div className="sd-container">
        <Reveal stagger className="sd-footer-grid">
          <div className="sd-footer-brand">
            <ShopsDoorLogo variant="reversed" size={34} />
            <p className="sd-footer-tagline">{t('footer.tagline')}</p>
            <p className="sd-footer-operated">{t('footer.operatedBy')}</p>
          </div>
          <div>
            <h3 className="sd-footer-head">{t('footer.product')}</h3>
            <ul>
              {NAV.map((item) => (
                <li key={item.id}>
                  <a href={`${home}${item.href}`} className="sd-link">{t(`nav.${item.id}` as 'nav.features')}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="sd-footer-head">{t('footer.company')}</h3>
            <ul>
              <li><Link href={localePath('/company', locale)} className="sd-link">{t('footer.companyInfo')}</Link></li>
              <li><a href={`mailto:${CONTACT_EMAIL}`} className="sd-link" dir="ltr">{CONTACT_EMAIL}</a></li>
              <li><Link href={localePath('/auth/login', locale)} className="sd-link">{tc('login')}</Link></li>
              <li><Link href={localePath('/auth/register', locale)} className="sd-link">{tc('register')}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="sd-footer-head">{t('footer.legal')}</h3>
            <ul>
              {legalPages.map((page) => (
                <li key={page.slug}>
                  <Link href={localePath(`/legal/${page.slug}`, locale)} className="sd-link">{page.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
      {/* Full-bleed outlined wordmark: a graphic, so it stays LTR in every locale. */}
      <Reveal y={48} className="sd-footer-wordmark-wrap">
        <span className="sd-footer-wordmark" dir="ltr" aria-hidden="true">
          ShopsDoor
        </span>
      </Reveal>
      <div className="sd-container">
        <div className="sd-footer-bottom">
          <span>© {new Date().getFullYear()} ShopsDoor. {t('footer.rights')}</span>
          <span dir="ltr">shopsdoor.com</span>
        </div>
      </div>
    </footer>
  );
}
