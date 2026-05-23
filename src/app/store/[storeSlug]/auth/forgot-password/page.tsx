'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';

export default function StoreForgotPasswordPage() {
  const t = useTranslations('auth');
  const lp = useLocalePath();
  const pathname = usePathname();
  const apiError = useApiError();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Resolve store slug from subdomain (usePathname returns the user-visible URL
  // after middleware rewrite, e.g. "/auth/forgot-password" not
  // "/store/ahmed-design/auth/forgot-password", so read from the hostname).
  const PLATFORM_DOMAINS = ['localhost', 'platform.com', 'www.platform.com'];
  const storeSlug = typeof window !== 'undefined'
    ? (() => {
        const hostname = window.location.hostname;
        if (PLATFORM_DOMAINS.includes(hostname)) return '';
        const parts = hostname.split('.');
        return parts.length >= 2 ? parts[0]! : '';
      })()
    : pathname.match(/\/store\/([^/]+)/)?.[1] || '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email, ...(storeSlug ? { store_slug: storeSlug } : {}) }),
      });
      // Always show a neutral success message — never reveal whether the email exists.
      setSuccess(true);
    } catch (err: unknown) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">
        {t('forgotPasswordTitle')}
      </h1>
      <p className="text-gray-500 text-center text-sm mb-8">{t('resetPasswordDesc')}</p>

      {success ? (
        <div className="text-center">
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {t('resetLinkSent')}
          </div>
          <Link
            href={lp('/auth/login')}
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--store-primary, #2563eb)' }}
          >
            {t('backToLogin')}
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('email')}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
            >
              {loading ? `${t('sendResetLink')}...` : t('sendResetLink')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link
              href={lp('/auth/login')}
              className="font-medium hover:underline"
              style={{ color: 'var(--store-primary, #2563eb)' }}
            >
              {t('backToLogin')}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
