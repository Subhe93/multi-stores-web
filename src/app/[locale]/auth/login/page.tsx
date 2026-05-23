'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

// Dashboard app URL — staff (creator/provider/admin) sign in there.
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3002';
const STAFF_ROLES = ['CREATOR', 'PROVIDER', 'ADMIN'];

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api<{
        user: { role: string };
        access_token: string;
        refresh_token: string;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      // Creators/providers manage their store in the dashboard app (separate origin —
      // tokens aren't shared), so send them there to sign in instead of the storefront.
      if (STAFF_ROLES.includes(data.user.role)) {
        window.location.href = `${DASHBOARD_URL}/auth/login`;
        return;
      }

      localStorage.setItem('auth_access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('auth_refresh_token', data.refresh_token);
      router.push('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <h1 className="text-2xl font-semibold text-slate-800 text-center mb-2">
        {t('loginTitle')}
      </h1>
      <p className="text-slate-500 text-center mb-8">
        {t('signIn')}
      </p>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email field */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
          />
        </div>

        {/* Password field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              {t('password')}
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-sm text-slate-500 hover:text-slate-800 transition"
            >
              {t('forgotPassword')}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
          />
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? t('signIn') + '...' : t('signIn')}
        </button>
      </form>

      {/* Register link */}
      <p className="mt-6 text-center text-sm text-slate-500">
        {t('noAccount')}{' '}
        <Link href="/auth/register" className="font-medium text-slate-800 hover:underline">
          {t('signUp')}
        </Link>
      </p>
    </div>
  );
}
