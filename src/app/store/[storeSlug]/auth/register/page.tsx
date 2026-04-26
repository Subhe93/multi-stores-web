'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { api } from '@/lib/api';

export default function StoreRegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const lp = useLocalePath();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
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
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-400 transition';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">
        {t('registerTitle')}
      </h1>
      <p className="text-gray-500 text-center text-sm mb-8">{t('customer')}</p>

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
            <input id="firstName" type="text" required value={firstName}
              onChange={(e) => setFirstName(e.target.value)} placeholder="John" className={inputClass} />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('lastName')}
            </label>
            <input id="lastName" type="text" required value={lastName}
              onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('email')}
          </label>
          <input id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('password')}
          </label>
          <input id="password" type="password" required value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={inputClass} />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
            {t('confirmPassword')}
          </label>
          <input id="confirmPassword" type="password" required value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" className={inputClass} />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
        >
          {loading ? `${t('signUp')}...` : t('signUp')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {t('hasAccount')}{' '}
        <Link
          href={lp('/auth/login')}
          className="font-medium hover:underline"
          style={{ color: 'var(--store-primary, #2563eb)' }}
        >
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
