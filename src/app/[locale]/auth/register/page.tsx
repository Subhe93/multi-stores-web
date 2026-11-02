'use client';

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Store, Megaphone, Package } from 'lucide-react';
import { api, type ApiError } from '@/lib/api';
import { DASHBOARD_LOGIN_URL } from '@/lib/brand';
import { localePath } from '@/lib/locale-path';

// Must match the API's RegisterDto (MinLength 8) so the server never has to
// reject what the form accepted.
const PASSWORD_MIN_LENGTH = 8;

/** Account kinds of `POST /auth/register` (onboarding SPEC §2). */
type AccountKind = 'independent' | 'marketplace' | 'supplier';

const ACCOUNT_KINDS: { kind: AccountKind; Icon: typeof Store }[] = [
  { kind: 'independent', Icon: Store },
  { kind: 'marketplace', Icon: Megaphone },
  { kind: 'supplier', Icon: Package },
];

/** API error codes with a friendly message of their own. */
const CODED_ERRORS: Record<string, string> = {
  AUTH_TERMS_REQUIRED: 'termsRequired',
  AUTH_EMAIL_DISPOSABLE: 'emailDisposable',
  AUTH_EMAIL_EXISTS: 'emailExists',
};

export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const kindLabelId = useId();

  // Public sign-up creates store-owner (CREATOR) accounts — independent or
  // marketplace store — and supplier (PROVIDER) accounts. Customers register
  // on their store. The API maps `account_kind` to the role.
  const [accountKind, setAccountKind] = useState<AccountKind | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  // Honeypot: hidden from people, filled by bots; the API ignores such
  // submissions silently (SPEC §2).
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const termsHref = localePath('/legal/terms', locale);
  const privacyHref = localePath('/legal/privacy', locale);

  // Radio-group keyboard model: arrows move and select, Space / Enter select.
  function onCardKeyDown(e: KeyboardEvent<HTMLDivElement>, index: number) {
    const last = ACCOUNT_KINDS.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = index === last ? 0 : index + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = index === 0 ? last : index - 1;
    else if (e.key === ' ' || e.key === 'Enter') next = index;
    if (next === null) return;
    e.preventDefault();
    setAccountKind(ACCOUNT_KINDS[next]!.kind);
    cardRefs.current[next]?.focus();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!accountKind) {
      setError(t('accountKindRequired'));
      return;
    }

    if (accountKind === 'supplier' && !companyName.trim()) {
      setError(t('companyNameRequired'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordsNoMatch'));
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(t('passwordMin8'));
      return;
    }

    if (!acceptTerms) {
      setError(t('termsRequired'));
      return;
    }

    setLoading(true);

    try {
      const data = await api<{ dashboard_login_url?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          account_kind: accountKind,
          accept_terms: true,
          first_name: firstName,
          last_name: lastName,
          ...(accountKind === 'supplier' ? { company_name: companyName.trim() } : {}),
          locale,
          website,
        }),
      });

      // The API returns a single-use dashboard sign-in link, so the new owner
      // lands in the dashboard already signed in; the plain login page is
      // the fallback.
      window.location.href = data?.dashboard_login_url || DASHBOARD_LOGIN_URL;
    } catch (err: unknown) {
      const code = (err as ApiError | null)?.code;
      const key = code ? CODED_ERRORS[code] : undefined;
      setError(key ? t(key) : t('registerFailed'));
    } finally {
      setLoading(false);
    }
  }

  // The chosen card is the tab stop; before a choice the first card is.
  const tabIndexFor = (kind: AccountKind, index: number) =>
    accountKind ? (accountKind === kind ? 0 : -1) : index === 0 ? 0 : -1;

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
        {/* Account kind */}
        <div className="sd-auth-field">
          <span id={kindLabelId} className="sd-auth-label">
            {t('accountKindLabel')}
          </span>
          <div role="radiogroup" aria-labelledby={kindLabelId} aria-required="true" className="sd-auth-kinds">
            {ACCOUNT_KINDS.map(({ kind, Icon }, index) => {
              const selected = accountKind === kind;
              return (
                <div
                  key={kind}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={tabIndexFor(kind, index)}
                  onClick={() => setAccountKind(kind)}
                  onKeyDown={(e) => onCardKeyDown(e, index)}
                  className={`sd-auth-kind${selected ? ' is-selected' : ''}`}
                >
                  <span className="sd-auth-kind-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="sd-auth-kind-title">{t(`accountKind.${kind}.title`)}</span>
                  <span className="sd-auth-kind-desc">{t(`accountKind.${kind}.desc`)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Supplier: company name */}
        {accountKind === 'supplier' && (
          <div className="sd-auth-field">
            <label htmlFor="companyName" className="sd-auth-label">
              {t('companyName')}
            </label>
            <input
              id="companyName"
              type="text"
              required
              autoComplete="organization"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t('companyNamePlaceholder')}
              className="sd-auth-input"
            />
          </div>
        )}

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

        {/* Honeypot: visually hidden, out of the tab order, never autofilled. */}
        <div className="sd-auth-honeypot" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        {/* Terms + privacy */}
        <label className="sd-auth-check">
          <input
            type="checkbox"
            required
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
          />
          <span>
            {t.rich('termsLabel', {
              terms: (chunks) => (
                <a href={termsHref} target="_blank" rel="noopener noreferrer" className="sd-auth-link">
                  {chunks}
                </a>
              ),
              privacy: (chunks) => (
                <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="sd-auth-link">
                  {chunks}
                </a>
              ),
            })}
          </span>
        </label>

        {/* Submit button */}
        <button type="submit" disabled={loading} className="sd-btn sd-btn-primary sd-auth-submit">
          <span className="sd-btn-label">{loading ? t('signUp') + '...' : t('signUp')}</span>
        </button>
      </form>

      {/* Login link */}
      <p className="sd-auth-foot">
        {t('hasAccount')}{' '}
        <a href={DASHBOARD_LOGIN_URL} className="sd-auth-link">
          {t('signIn')}
        </a>
      </p>
    </div>
  );
}
