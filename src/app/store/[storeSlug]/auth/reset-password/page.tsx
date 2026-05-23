'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';

export default function StoreResetPasswordPage() {
  const t = useTranslations('auth');
  const lp = useLocalePath();
  const searchParams = useSearchParams();
  const apiError = useApiError();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(t('invalidResetLink'));
      return;
    }
    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setLoading(true);

    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
    } catch (err: unknown) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">
        {t('resetPasswordTitle')}
      </h1>
      <p className="text-gray-500 text-center text-sm mb-8">{t('resetPasswordPageDesc')}</p>

      {!token ? (
        <div className="text-center">
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {t('invalidResetLink')}
          </div>
          <Link
            href={lp('/auth/login')}
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--store-primary, #2563eb)' }}
          >
            {t('backToLogin')}
          </Link>
        </div>
      ) : success ? (
        <div className="text-center">
          <div className="mb-6 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {t('resetSuccess')}
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('newPassword')}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
            >
              {loading ? `${t('resetButton')}...` : t('resetButton')}
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
