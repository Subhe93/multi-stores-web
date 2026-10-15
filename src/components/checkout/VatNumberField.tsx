'use client';

import { useState, type ChangeEvent } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import { useVatCheck } from '@/hooks/useVatCheck';
import { vatCheckMessageKey, type VatCheckResult, type VatMessageTone } from '@/lib/vatCheck';

// ── VAT number with live validation (b2b app, M2.5-DESIGN §5) ────────────────
// Replaces the plain VAT input when the store has reverse charge on. The
// number is format-checked locally, then validated against VIES through the
// storefront endpoint (debounced, immediately on blur) for the current
// shipping destination. The message only explains what the server will do;
// the quote / order decide the exemption themselves.

interface VatNumberFieldProps {
  id: string;
  name?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  storeSlug: string;
  /** Shipping destination (ISO2); omitted in Kustom until it knows the address. */
  countryCode?: string | null;
  /** Submit-time validation message of the page (wins over the check state). */
  error?: string;
  placeholder?: string;
  inputClassName: (hasError: boolean) => string;
  onResult?: (result: VatCheckResult | null) => void;
  /** Called after the field lost focus (the check is started too). */
  onBlur?: () => void;
  required?: boolean;
}

const TONE_CLS: Record<VatMessageTone, string> = {
  muted: 'text-gray-500',
  success: 'text-green-700',
  neutral: 'text-gray-700',
  error: 'text-red-600',
  warning: 'text-amber-700',
};

function ToneIcon({ tone }: { tone: VatMessageTone }) {
  const cls = 'w-3.5 h-3.5 mt-px shrink-0';
  if (tone === 'muted') return <Loader2 className={`${cls} animate-spin`} />;
  if (tone === 'success') return <CheckCircle2 className={cls} />;
  if (tone === 'error') return <XCircle className={cls} />;
  if (tone === 'warning') return <AlertTriangle className={cls} />;
  return <Info className={cls} />;
}

export function VatNumberField({
  id, name = 'vat_number', value, onChange, storeSlug, countryCode, error, placeholder, inputClassName, onResult,
  onBlur, required,
}: VatNumberFieldProps) {
  const t = useTranslations();
  // Format errors are shown once the shopper left the field, not mid-typing.
  const [blurred, setBlurred] = useState(false);
  const check = useVatCheck({ storeSlug, enabled: true, vatNumber: value, countryCode, onResult });

  const message = vatCheckMessageKey(check.state, check.result?.reverseCharge ?? null, check.result?.why ?? null);
  const hideFormatError = check.state === 'format_invalid' && !blurred;
  const showMessage = !error && message && !hideFormatError;
  const hasError = Boolean(error) || (check.state === 'format_invalid' && blurred) || check.state === 'invalid';

  return (
    <div>
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => { setBlurred(false); onChange(e); }}
        onBlur={() => { setBlurred(true); check.checkNow(); onBlur?.(); }}
        aria-required={required || undefined}
        className={inputClassName(hasError)}
        placeholder={placeholder}
        autoComplete="off"
        aria-describedby={`${id}_status`}
      />
      <div id={`${id}_status`} aria-live="polite">
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        {showMessage && (
          <p className={`mt-1 flex items-start gap-1.5 text-xs ${TONE_CLS[message.tone]}`}>
            <ToneIcon tone={message.tone} />
            <span>
              {t(message.key)}
              {check.state === 'valid' && check.result?.name && (
                <span className="block font-medium">{check.result.name}</span>
              )}
            </span>
          </p>
        )}
        {!error && check.state === 'valid' && (
          <p className="mt-0.5 text-[11px] text-gray-400">{t('b2b.vat.ownershipNote')}</p>
        )}
      </div>
    </div>
  );
}
