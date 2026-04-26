'use client';

import { useTranslations } from 'next-intl';

export interface ShippingForm {
  email: string;
  full_name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  phone: string;
}

export const INITIAL_SHIPPING_FORM: ShippingForm = {
  email: '',
  full_name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country_code: '',
  phone: '',
};

const COUNTRIES = [
  { code: 'DE', name: 'Germany' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'TR', name: 'Turkey' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'QA', name: 'Qatar' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'LB', name: 'Lebanon' },
];

interface AddressFormProps {
  form: ShippingForm;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  errors?: Record<string, string>;
  error?: string;
  showEmail?: boolean;
}

const inputClass = (hasError: boolean) =>
  `w-full rounded-lg border px-4 py-2.5 text-sm transition focus:outline-none focus:ring-2 ${
    hasError
      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
      : 'border-gray-200 focus:ring-[var(--store-primary,#2563eb)]/20 focus:border-[var(--store-primary,#2563eb)]'
  }`;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

export function AddressForm({ form, onChange, errors = {}, error, showEmail = true }: AddressFormProps) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      {/* Global error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Contact email */}
      {showEmail && (
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">{t('checkout.contactInfo')}</h3>
          <div>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              placeholder={t('checkout.email')}
              className={inputClass(!!errors.email)}
            />
            <FieldError message={errors.email} />
          </div>
        </div>
      )}

      {/* Shipping address */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">{t('checkout.shippingAddress')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Full name */}
          <div className="sm:col-span-2">
            <input
              id="full_name"
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={onChange}
              placeholder={`${t('checkout.firstName')} ${t('checkout.lastName')}`}
              className={inputClass(!!errors.full_name)}
            />
            <FieldError message={errors.full_name} />
          </div>

          {/* Address line 1 */}
          <div className="sm:col-span-2">
            <input
              id="line1"
              name="line1"
              type="text"
              value={form.line1}
              onChange={onChange}
              placeholder={t('checkout.address')}
              className={inputClass(!!errors.line1)}
            />
            <FieldError message={errors.line1} />
          </div>

          {/* Address line 2 */}
          <div className="sm:col-span-2">
            <input
              id="line2"
              name="line2"
              type="text"
              value={form.line2}
              onChange={onChange}
              placeholder="Apt / Suite / Floor"
              className={inputClass(false)}
            />
          </div>

          {/* City */}
          <div>
            <input
              id="city"
              name="city"
              type="text"
              value={form.city}
              onChange={onChange}
              placeholder={t('checkout.city')}
              className={inputClass(!!errors.city)}
            />
            <FieldError message={errors.city} />
          </div>

          {/* State */}
          <div>
            <input
              id="state"
              name="state"
              type="text"
              value={form.state}
              onChange={onChange}
              placeholder={t('checkout.state')}
              className={inputClass(false)}
            />
          </div>

          {/* Postal code */}
          <div>
            <input
              id="postal_code"
              name="postal_code"
              type="text"
              value={form.postal_code}
              onChange={onChange}
              placeholder={t('checkout.postalCode')}
              className={inputClass(!!errors.postal_code)}
            />
            <FieldError message={errors.postal_code} />
          </div>

          {/* Country */}
          <div>
            <select
              id="country_code"
              name="country_code"
              value={form.country_code}
              onChange={onChange}
              className={inputClass(!!errors.country_code)}
            >
              <option value="">{t('checkout.country')}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError message={errors.country_code} />
          </div>

          {/* Phone */}
          <div className="sm:col-span-2">
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={onChange}
              placeholder={t('checkout.phone')}
              className={inputClass(!!errors.phone)}
            />
            <FieldError message={errors.phone} />
          </div>
        </div>
      </div>
    </div>
  );
}
