'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useAuth, isNotCustomerAccountError } from '@/hooks/useAuth';
import { useApiError } from '@/lib/useApiError';

export default function StoreLoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const lp = useLocalePath();
  const { login } = useAuth();
  const apiError = useApiError();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push(lp('/'));
    } catch (err: unknown) {
      // Dashboard accounts get a dedicated message; every other failure
      // (wrong password, network, ...) keeps the generic API error path.
      setError(isNotCustomerAccountError(err) ? t('dashboardAccountNotAllowed') : apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
        {t('loginTitle')}
      </h1>
      <p className="text-gray-500 text-center text-sm mb-8">{t('loginSubtitle')}</p>

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
          <div className="relative">
          <Mail className="pointer-events-none absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-gray-200 ps-10 pe-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition"
          />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              {t('password')}
            </label>
            <Link
              href={lp('/auth/forgot-password')}
              className="text-sm font-medium underline underline-offset-2 hover:opacity-80"
              style={{ color: 'var(--theme-colors-link, var(--theme-colors-price, var(--store-primary, #2563eb)))' }}
            >
              {t('forgotPassword')}
            </Link>
          </div>
          <div className="relative">
          <Lock className="pointer-events-none absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            className="w-full rounded-xl border border-gray-200 ps-10 pe-11 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            aria-pressed={showPassword}
            className="absolute inset-e-2 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
        >
          {loading ? `${t('signIn')}...` : t('signIn')}
        </button>
      </form>

      <p className="mt-6 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
        {t('noAccount')}{' '}
        <Link
          href={lp('/auth/register')}
          className="font-semibold underline underline-offset-2 hover:opacity-80"
          style={{ color: 'var(--theme-colors-link, var(--theme-colors-price, var(--store-primary, #2563eb)))' }}
        >
          {t('signUp')}
        </Link>
      </p>
    </div>
  );
}
