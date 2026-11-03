'use client';

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Megaphone, Package, Store } from 'lucide-react';
import { api, type ApiError } from '@/lib/api';
import { DASHBOARD_LOGIN_URL } from '@/lib/brand';
import { localePath } from '@/lib/locale-path';
import { gsap, useGSAP, DUR, EASE, prefersReducedMotion } from '@/lib/animations';
import { RegisterArt } from './RegisterArt';
import { TURNSTILE_SITE_KEY, TurnstileWidget } from './Turnstile';

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

/** Three "what you get" lines per path (auth.accountKind.<kind>.point<n>). */
const POINTS = [1, 2, 3] as const;

/** API error codes with a friendly message of their own. */
const CODED_ERRORS: Record<string, string> = {
  AUTH_TERMS_REQUIRED: 'termsRequired',
  AUTH_EMAIL_DISPOSABLE: 'emailDisposable',
  AUTH_EMAIL_EXISTS: 'emailExists',
  AUTH_CAPTCHA_FAILED: 'captchaFailed',
  AUTH_CAPTCHA_UNAVAILABLE: 'captchaUnavailable',
};

type Step = 1 | 2;

/**
 * Two-step sign-up wizard: step 1 picks the path (account kind) on three
 * illustrated cards, step 2 collects the details in a centred card. One
 * <form> wraps both steps so Enter submits on step 2 and the submit guard
 * still refuses a missing kind.
 */
export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const uid = useId();

  const [step, setStep] = useState<Step>(1);
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
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  // Honeypot: hidden from people, filled by bots; the API ignores such
  // submissions silently (SPEC §2).
  const [website, setWebsite] = useState('');
  // Turnstile (wave 3): only while the site key is set. The token is
  // single-use, so the widget is reset after every failed submit.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rootRef = useRef<HTMLFormElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  const termsHref = localePath('/legal/terms', locale);
  const privacyHref = localePath('/legal/privacy', locale);

  // Light reveal of the active step: fade + 12px slide, skipped for
  // reduced-motion users.
  useGSAP(
    () => {
      const el = stepRef.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(el, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: DUR.fast, ease: EASE.out, clearProps: 'transform' });
    },
    { dependencies: [step], scope: rootRef },
  );

  function goTo(next: Step) {
    setError('');
    setStep(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function continueToDetails() {
    if (!accountKind) {
      setError(t('accountKindRequired'));
      return;
    }
    goTo(2);
  }

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

    // Enter on step 1 moves on instead of submitting.
    if (step === 1) {
      goTo(2);
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

    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError(t('captchaRequired'));
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
          ...(TURNSTILE_SITE_KEY && captchaToken ? { turnstile_token: captchaToken } : {}),
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
      if (TURNSTILE_SITE_KEY) {
        setCaptchaToken(null);
        setCaptchaReset((n) => n + 1);
      }
    } finally {
      setLoading(false);
    }
  }

  // The chosen card is the tab stop; before a choice the first card is.
  const tabIndexFor = (kind: AccountKind, index: number) =>
    accountKind ? (accountKind === kind ? 0 : -1) : index === 0 ? 0 : -1;

  const chosen = ACCOUNT_KINDS.find((k) => k.kind === accountKind);
  const passwordType = showPassword ? 'text' : 'password';
  const toggleLabel = showPassword ? t('hidePassword') : t('showPassword');

  const errorAlert = error ? (
    <div className="sd-auth-alert sd-auth-alert-error" role="alert">
      {error}
    </div>
  ) : null;

  return (
    <form ref={rootRef} onSubmit={handleSubmit} className="sd-wiz">
      {/* Step indicator */}
      <ol className="sd-wiz-steps sd-eyebrow" aria-label={`${t('wizard.step1')} / ${t('wizard.step2')}`}>
        <li className={`sd-wiz-step-item ${step === 1 ? 'is-active' : 'is-done'}`} aria-current={step === 1 ? 'step' : undefined}>
          <span className="sd-wiz-step-num" aria-hidden="true">{step === 1 ? '1' : <Check />}</span>
          <span>{t('wizard.step1')}</span>
        </li>
        <li className="sd-wiz-step-sep" role="presentation" aria-hidden="true" />
        <li className={`sd-wiz-step-item ${step === 2 ? 'is-active' : ''}`} aria-current={step === 2 ? 'step' : undefined}>
          <span className="sd-wiz-step-num" aria-hidden="true">2</span>
          <span>{t('wizard.step2')}</span>
        </li>
      </ol>

      {step === 1 ? (
        <div key="step-1" ref={stepRef} className="sd-wiz-step">
          <div className="sd-wiz-head">
            <h1 id={`${uid}-title`} className="sd-wiz-title">{t('wizard.title')}</h1>
            <p className="sd-wiz-lead">{t('wizard.lead')}</p>
          </div>

          {/* Path cards: a radio group of three */}
          <div role="radiogroup" aria-labelledby={`${uid}-title`} aria-required="true" className="sd-wiz-paths">
            {ACCOUNT_KINDS.map(({ kind }, index) => {
              const selected = accountKind === kind;
              return (
                <div
                  key={kind}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  role="radio"
                  aria-checked={selected}
                  aria-labelledby={`${uid}-${kind}-title`}
                  aria-describedby={`${uid}-${kind}-desc`}
                  tabIndex={tabIndexFor(kind, index)}
                  onClick={() => setAccountKind(kind)}
                  onKeyDown={(e) => onCardKeyDown(e, index)}
                  className={`sd-card sd-wiz-path${selected ? ' is-selected' : ''}`}
                >
                  <span className="sd-wiz-path-art">
                    <RegisterArt art={kind} />
                  </span>
                  <span className="sd-wiz-path-check" aria-hidden="true">
                    <Check />
                  </span>
                  <span className="sd-wiz-path-body">
                    <span id={`${uid}-${kind}-title`} className="sd-wiz-path-title">{t(`accountKind.${kind}.title`)}</span>
                    <span id={`${uid}-${kind}-desc`} className="sd-wiz-path-desc">{t(`accountKind.${kind}.desc`)}</span>
                    <ul className="sd-wiz-path-points">
                      {POINTS.map((n) => (
                        <li key={n}>
                          <Check aria-hidden="true" />
                          <span>{t(`accountKind.${kind}.point${n}`)}</span>
                        </li>
                      ))}
                    </ul>
                  </span>
                </div>
              );
            })}
          </div>

          {errorAlert && <div className="sd-wiz-alert">{errorAlert}</div>}

          <div className="sd-wiz-actions">
            <button type="button" disabled={!accountKind} onClick={continueToDetails} className="sd-btn sd-btn-primary">
              <span className="sd-btn-label">
                {t('wizard.continue')}
                <ArrowRight aria-hidden="true" />
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div key="step-2" ref={stepRef} className="sd-wiz-step">
          <div className="sd-wiz-card">
            {/* Chosen path chip + change link */}
            <div className="sd-wiz-chip-row">
              <span className="sd-wiz-chip">
                <span className="sd-wiz-chip-icon" aria-hidden="true">
                  {chosen ? <chosen.Icon /> : null}
                </span>
                <span>{chosen ? t(`accountKind.${chosen.kind}.title`) : ''}</span>
              </span>
              <button type="button" onClick={() => goTo(1)} className="sd-wiz-chip-change">
                {t('wizard.change')}
              </button>
            </div>

            <div className="sd-wiz-card-head">
              <h1 className="sd-wiz-card-title">{t('wizard.detailsTitle')}</h1>
              <p className="sd-wiz-card-lead">{t('wizard.detailsLead')}</p>
            </div>

            {errorAlert}

            <div className="sd-auth-form">
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
                    autoFocus
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
                <div className="sd-wiz-pw">
                  <input
                    id="password"
                    type={passwordType}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('registerPasswordPlaceholder')}
                    className="sd-auth-input"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={toggleLabel} aria-pressed={showPassword} className="sd-wiz-pw-toggle">
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
              </div>

              {/* Confirm password field */}
              <div className="sd-auth-field">
                <label htmlFor="confirmPassword" className="sd-auth-label">
                  {t('confirmPassword')}
                </label>
                <div className="sd-wiz-pw">
                  <input
                    id="confirmPassword"
                    type={passwordType}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('confirmPasswordPlaceholder')}
                    className="sd-auth-input"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={toggleLabel} aria-pressed={showPassword} className="sd-wiz-pw-toggle">
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
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

              {/* Security check (Cloudflare Turnstile), only with a site key */}
              {TURNSTILE_SITE_KEY && (
                <div className="sd-auth-field">
                  <TurnstileWidget
                    siteKey={TURNSTILE_SITE_KEY}
                    language={locale}
                    label={t('captchaLabel')}
                    onToken={setCaptchaToken}
                    resetSignal={captchaReset}
                  />
                </div>
              )}

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

              {/* Back + submit */}
              <div className="sd-wiz-form-actions">
                <button type="button" onClick={() => goTo(1)} className="sd-btn sd-btn-secondary">
                  <span className="sd-btn-label">
                    <ArrowLeft aria-hidden="true" />
                    {t('wizard.back')}
                  </span>
                </button>
                <button type="submit" disabled={loading} className="sd-btn sd-btn-primary">
                  <span className="sd-btn-label">{loading ? t('wizard.createAccount') + '…' : t('wizard.createAccount')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
