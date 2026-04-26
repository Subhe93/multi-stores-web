'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('account');
  const router = useRouter();

  const NAV_ITEMS = [
    { label: t('profile'), href: '/account' },
    { label: t('orders'), href: '/account/orders' },
    { label: t('addresses'), href: '/account/addresses' },
  ];
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check auth on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_access_token');
    if (!token) {
      router.push('/auth/login');
    } else {
      setAuthenticated(true);
    }
    setChecking(false);
  }, [router]);

  if (checking || !authenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-slate-400 text-sm">Checking authentication...</p>
        </main>
        <Footer />
      </div>
    );
  }

  // Resolve active nav item (strip locale prefix for matching)
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(-[a-z]{2})?/, '') || '/account';

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Sidebar navigation */}
            <aside className="md:col-span-1">
              <nav className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">
                  {t('title')}
                </h2>
                <ul className="space-y-1">
                  {NAV_ITEMS.map((item) => {
                    const isActive =
                      item.href === '/account'
                        ? pathWithoutLocale === '/account'
                        : pathWithoutLocale.startsWith(item.href);

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`block px-3 py-2 rounded-lg text-sm transition ${
                            isActive
                              ? 'bg-slate-800 text-white font-medium'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>

            {/* Main content */}
            <div className="md:col-span-3">{children}</div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
