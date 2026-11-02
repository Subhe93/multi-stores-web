'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

type Role = 'creator' | 'provider';

// Dashboard app URL — staff (creator/provider) sign in there after registering.
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3002';

export default function RegisterPage() {
  const t = useTranslations('auth');

  // Customers register through their store's storefront, not the platform.
  const ROLES: { value: Role; label: string }[] = [
    { value: 'creator', label: t('creator') },
    { value: 'provider', label: t('provider') },
  ];
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('creator');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (password !== confirmPassword) {
      setError(t('passwordsNoMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('passwordMin6'));
      return;
    }

    setLoading(true);

    try {
      await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          role: role.toUpperCase(),
          first_name: firstName,
          last_name: lastName,
        }),
      });

      // Creators/providers manage their store in the dashboard app — send them there to sign in.
      window.location.href = `${DASHBOARD_URL}/auth/login`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('registerFailed');
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
        <h1 className="sd-auth-title">{t('registerTitle')}</h1>
      </div>

      {error && (
        <div className="sd-auth-alert sd-auth-alert-error" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="sd-auth-form">
        {/* Role selector: pill segmented control */}
        <div className="sd-auth-field">
          <span className="sd-auth-label" id="register-role-label">
            {t('registerAs')}
          </span>
          <div className="sd-auth-segment" role="group" aria-labelledby="register-role-label">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                aria-pressed={role === r.value}
                className={role === r.value ? 'is-active' : undefined}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name fields */}
        <div className="sd-auth-grid-2">
          <div className="sd-auth-field">
            <label htmlFor="firstName" className="sd-auth-label">
              {t('firstName')}
            </label>
            <input
              id="firstName"
              type="text"
              required
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t('firstNamePlaceholder')}
              className="sd-auth-input"
            />
          </div>
          <div className="sd-auth-field">
            <label htmlFor="lastName" className="sd-auth-label">
              {t('lastName')}
            </label>
            <input
              id="lastName"
              type="text"
              required
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t('lastNamePlaceholder')}
              className="sd-auth-input"
            />
          </div>
        </div>

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
          <label htmlFor="password" className="sd-auth-label">
            {t('password')}
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('registerPasswordPlaceholder')}
            className="sd-auth-input"
          />
        </div>

        {/* Confirm password field */}
        <div className="sd-auth-field">
          <label htmlFor="confirmPassword" className="sd-auth-label">
            {t('confirmPassword')}
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('confirmPasswordPlaceholder')}
            className="sd-auth-input"
          />
        </div>

        {/* Submit button */}
        <button type="submit" disabled={loading} className="sd-btn sd-btn-primary sd-auth-submit">
          <span className="sd-btn-label">{loading ? t('signUp') + '...' : t('signUp')}</span>
        </button>
      </form>

      {/* Login link */}
      <p className="sd-auth-foot">
        {t('hasAccount')}{' '}
        <Link href="/auth/login" className="sd-auth-link">
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
