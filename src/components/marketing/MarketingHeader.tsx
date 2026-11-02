import { getTranslations } from 'next-intl/server';
import { localePath } from '@/lib/locale-path';
import { NAV } from '@/lib/brand';
import { HeaderClient } from './HeaderClient';

// Shared marketing-site header (landing, company, legal). Server component
// that resolves copy and hands the interactive shell to HeaderClient.
export async function MarketingHeader({ locale, solid = false }: { locale: string; solid?: boolean }) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const home = localePath('/', locale);
  // Anchors only work on the landing page; other pages link back to it.
  const links = NAV.map((item) => ({
    id: item.id,
    label: t(`nav.${item.id}` as 'nav.features'),
    href: solid ? `${home}${item.href}` : item.href,
  }));

  return (
    <HeaderClient
      locale={locale}
      homeHref={home}
      links={links}
      loginHref={localePath('/auth/login', locale)}
      loginLabel={t('nav.login')}
      ctaHref={localePath('/auth/register', locale)}
      ctaLabel={t('nav.getStarted')}
      menuLabel={t('nav.menu')}
      closeLabel={t('nav.close')}
      languageLabel={t('nav.language')}
      solid={solid}
    />
  );
}
