import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { localePath } from '@/lib/locale-path';
import { ThemeToggle } from '@/components/home/ThemeToggle';

// Shared marketing-site header used by the [locale] landing page and the
// platform legal pages so they share the same top chrome.
export async function MarketingHeader({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const tc = await getTranslations({ locale, namespace: 'common' });

  return (
    <nav className="fixed top-0 inset-x-0 z-50" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="absolute inset-0 backdrop-blur-xl" style={{ background: 'var(--bg-nav)' }} />
      <div className="relative max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href={localePath('/', locale)} className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Multi<span style={{ color: 'var(--text-brand)' }}>Stores</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href={localePath('/auth/login', locale)}
            className="text-sm font-medium transition px-4 py-2 hidden sm:block"
            style={{ color: 'var(--text-secondary)' }}
          >
            {tc('login')}
          </Link>
          <Link
            href={localePath('/auth/register', locale)}
            className="text-sm font-medium transition px-5 py-2 rounded-full"
            style={{ background: 'var(--cta-btn-bg)', color: 'var(--cta-btn-text)' }}
          >
            {t('getStarted')}
          </Link>
        </div>
      </div>
    </nav>
  );
}
