'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
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
      const message = err instanceof Error ? err.message : t('requestFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sd-auth-card">
      <div className="sd-auth-head">
        <h1 className="sd-auth-title">{t('resetPasswordTitle')}</h1>
        <p className="sd-auth-sub">{t('resetPasswordPageDesc')}</p>
      </div>

      {!token ? (
        // Invalid / missing token state
        <div className="sd-auth-stack sd-auth-card-center">
          <div className="sd-auth-alert sd-auth-alert-error" role="alert">
            {t('invalidResetLink')}
          </div>
          <Link href="/auth/login" className="sd-auth-link">
            {t('backToLogin')}
          </Link>
        </div>
      ) : success ? (
        // Success state
        <div className="sd-auth-stack sd-auth-card-center">
          <div className="sd-auth-alert sd-auth-alert-success" role="status">
            {t('resetSuccess')}
          </div>
          <Link href="/auth/login" className="sd-auth-link">
            {t('backToLogin')}
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="sd-auth-alert sd-auth-alert-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="sd-auth-form">
            {/* New password field */}
            <div className="sd-auth-field">
              <label htmlFor="password" className="sd-auth-label">
                {t('newPassword')}
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('newPasswordPlaceholder')}
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
              <span className="sd-btn-label">{loading ? t('resetButton') + '...' : t('resetButton')}</span>
            </button>
          </form>

          {/* Back to login link */}
          <p className="sd-auth-foot">
            <Link href="/auth/login" className="sd-auth-link">
              {t('backToLogin')}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
