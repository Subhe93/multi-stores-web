'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

// Dashboard app URL — staff (creator/provider/admin) sign in there.
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3002';
const STAFF_ROLES = ['CREATOR', 'PROVIDER', 'ADMIN'];

/**
 * Platform sign-in is for staff only. Customer accounts belong to one store
 * and sign in on that store, so the request carries no store context (the
 * API then only matches staff) and a customer session is never kept here.
 */

export default function LoginPage() {
  const t = useTranslations('auth');
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
        user?: { role: string };
        access_token?: string;
        refresh_token?: string;
        // Set instead of tokens when the account has two-step verification.
        requires_2fa?: boolean;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      // Creators/providers manage their store in the dashboard app (separate origin —
      // tokens aren't shared), so send them there to sign in instead of the storefront.
      // Only staff accounts can have two-step verification, so a 2FA challenge
      // means a staff account too: it finishes signing in on the dashboard.
      if (data.requires_2fa === true || STAFF_ROLES.includes(data.user?.role ?? '')) {
        window.location.href = `${DASHBOARD_URL}/auth/login`;
        return;
      }

      // Anything else is a customer account: its tokens are not stored.
      setError(t('platformCustomerSignIn'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('loginFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sd-auth-card">
      <div className="sd-auth-head">
        <span className="sd-eyebrow sd-eyebrow-teal">
          <span className="sd-eyebrow-dot" aria-hidden="true" />
          {t('platformStaffOnly')}
        </span>
        <h1 className="sd-auth-title">{t('loginTitle')}</h1>
        <p className="sd-auth-hint">{t('platformCustomerSignIn')}</p>
      </div>

      {error && (
        <div className="sd-auth-alert sd-auth-alert-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="sd-auth-form">
        {/* Email field */}
        <div className="sd-auth-field">
          <label htmlFor="email" className="sd-auth-label">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="sd-auth-input"
          />
        </div>

        {/* Password field */}
        <div className="sd-auth-field">
          <div className="sd-auth-field-row">
            <label htmlFor="password" className="sd-auth-label">
              {t('password')}
            </label>
            <Link href="/auth/forgot-password" className="sd-auth-link sd-auth-link-sm">
              {t('forgotPassword')}
            </Link>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            className="sd-auth-input"
          />
        </div>

        {/* Submit button */}
        <button type="submit" disabled={loading} className="sd-btn sd-btn-primary sd-auth-submit">
          <span className="sd-btn-label">{loading ? t('signIn') + '...' : t('signIn')}</span>
        </button>
      </form>

      {/* Register link */}
      <p className="sd-auth-foot">
        {t('noAccount')}{' '}
        <Link href="/auth/register" className="sd-auth-link">
          {t('signUp')}
        </Link>
      </p>
    </div>
  );
}
