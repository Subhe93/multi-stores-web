'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

/** Staff password reset: no store context is sent, so the API only matches
 *  staff accounts. Customers reset on the store where they shopped. */
export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
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
        <h1 className="sd-auth-title">{t('forgotPasswordTitle')}</h1>
        <p className="sd-auth-sub">{t('resetPasswordDesc')}</p>
        <p className="sd-auth-hint">{t('platformForgotHint')}</p>
      </div>

      {success ? (
        // Success state
        <div className="sd-auth-stack sd-auth-card-center">
          <div className="sd-auth-alert sd-auth-alert-success" role="status">
            {t('resetLinkSent')}
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

            {/* Submit button */}
            <button type="submit" disabled={loading} className="sd-btn sd-btn-primary sd-auth-submit">
              <span className="sd-btn-label">{loading ? t('sendResetLink') + '...' : t('sendResetLink')}</span>
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
