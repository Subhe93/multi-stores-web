'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { api } from '@/lib/api';
import { useApiError } from '@/lib/useApiError';

export default function StoreRegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const lp = useLocalePath();
  const apiError = useApiError();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('passwordsNoMatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('passwordMinLength'));
      return;
    }

    setLoading(true);

    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          role: 'CUSTOMER',
          first_name: firstName,
          last_name: lastName,
        }),
      });
      router.push(lp('/auth/login'));
    } catch (err: unknown) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition';

  // Icon inside the field (decorative) + the shared input style.
  const iconClass = 'pointer-events-none absolute inset-s-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400';
  const withIcon = inputClass.replace('px-4', 'ps-10 pe-4');
  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
      className="absolute inset-e-2 top-1/2 -translate-y-1/2 inline-flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition"
    >
      {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
    </button>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">
        {t('registerTitle')}
      </h1>
      <p className="text-gray-500 text-center text-sm mb-8">{t('registerSubtitle')}</p>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('firstName')}
            </label>
            <div className="relative">
              <User className={iconClass} aria-hidden="true" />
              <input id="firstName" name="firstName" type="text" required autoComplete="given-name" value={firstName}
                onChange={(e) => setFirstName(e.target.value)} className={withIcon} />
            </div>
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('lastName')}
            </label>
            <div className="relative">
              <User className={iconClass} aria-hidden="true" />
              <input id="lastName" name="lastName" type="text" required autoComplete="family-name" value={lastName}
                onChange={(e) => setLastName(e.target.value)} className={withIcon} />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('email')}
          </label>
          <div className="relative">
            <Mail className={iconClass} aria-hidden="true" />
            <input id="email" name="email" type="email" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={withIcon} />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('password')}
          </label>
          <div className="relative">
            <Lock className={iconClass} aria-hidden="true" />
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder={t('newPasswordPlaceholder')} className={withIcon.replace('pe-4', 'pe-11')} />
            {passwordToggle}
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('confirmPassword')}
          </label>
          <div className="relative">
            <Lock className={iconClass} aria-hidden="true" />
            <input id="confirmPassword" name="confirmPassword" type={showPassword ? 'text' : 'password'} required autoComplete="new-password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('confirmPasswordPlaceholder')} className={withIcon} />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--store-primary, #2563eb)', color: 'var(--store-primary-contrast, #fff)' }}
        >
          {loading ? `${t('signUp')}...` : t('signUp')}
        </button>
      </form>

      <p className="mt-6 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
        {t('hasAccount')}{' '}
        <Link
          href={lp('/auth/login')}
          className="font-semibold underline underline-offset-2 hover:opacity-80"
          style={{ color: 'var(--theme-colors-link, var(--theme-colors-price, var(--store-primary, #2563eb)))' }}
        >
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
