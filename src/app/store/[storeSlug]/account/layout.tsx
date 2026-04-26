'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth } from '@/hooks/useAuth';
import { User, Package, MapPin, LogOut } from 'lucide-react';

export default function StoreAccountLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('account');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const lp = useLocalePath();
  const { token, loading, logout } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!token) {
        router.replace(lp('/auth/login'));
      } else {
        setReady(true);
      }
    }
  }, [loading, token, router, lp]);

  const handleLogout = async () => {
    await logout();
    router.push(lp('/'));
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400 animate-pulse">{tCommon('loading')}</p>
      </div>
    );
  }

  const navItems = [
    { href: lp('/account'), icon: User, label: t('profile') },
    { href: lp('/account/orders'), icon: Package, label: t('orders') },
    { href: lp('/account/addresses'), icon: MapPin, label: t('addresses') },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-1">
          <h2 className="text-sm font-semibold text-gray-900 px-3 mb-3">{t('title')}</h2>
          {navItems.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            {tCommon('logout')}
          </button>
        </aside>

        {/* Main content */}
        <main>{children}</main>
      </div>
    </div>
  );
}
