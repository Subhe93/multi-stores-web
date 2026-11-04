'use client';

import { useLocale, useTranslations } from 'next-intl';
import { TURNSTILE_SITE_KEY, TurnstileWidget } from '@/app/[locale]/auth/(wizard)/register/Turnstile';

/**
 * Turnstile on storefront customer forms (sign-up, guest checkout). On only
 * when the site key is set AND `NEXT_PUBLIC_TURNSTILE_CUSTOMERS=on`, which
 * must match the API's `TURNSTILE_CUSTOMERS`. Store pages run on custom
 * domains: each one has to be listed in the Turnstile widget's hostnames.
 */
export const CUSTOMER_CAPTCHA_ON =
  Boolean(TURNSTILE_SITE_KEY) &&
  /^(on|1|true)$/i.test(process.env.NEXT_PUBLIC_TURNSTILE_CUSTOMERS || '');

export function CustomerCaptcha({
  onToken,
  resetSignal,
  className,
}: {
  onToken: (token: string | null) => void;
  /** Bump after every failed submit: a token is single-use. */
  resetSignal?: number;
  className?: string;
}) {
  const t = useTranslations('auth');
  const locale = useLocale();
  if (!CUSTOMER_CAPTCHA_ON) return null;
  return (
    <div className={className}>
      <TurnstileWidget
        siteKey={TURNSTILE_SITE_KEY}
        language={locale}
        label={t('captchaLabel')}
        onToken={onToken}
        resetSignal={resetSignal}
      />
    </div>
  );
}
