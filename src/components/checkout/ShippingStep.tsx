'use client';

import { useTranslations } from 'next-intl';
import { ShippingOptions } from './ShippingOptions';
import type { ShippingForm } from './AddressForm';

interface ShippingStepProps {
  form: ShippingForm;
  shippingOptionId: string | null;
  onSelectShipping: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export function ShippingStep({
  form,
  shippingOptionId,
  onSelectShipping,
  onContinue,
  onBack,
}: ShippingStepProps) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      {/* Address summary */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 text-gray-600">
            <p className="font-medium text-gray-900">{form.full_name}</p>
            <p>{form.line1}{form.line2 ? `, ${form.line2}` : ''}</p>
            <p>{form.city}{form.state ? `, ${form.state}` : ''} {form.postal_code}</p>
            {form.phone && <p>{form.phone}</p>}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium shrink-0"
            style={{ color: 'var(--store-primary, #2563eb)' }}
          >
            {t('common.edit')}
          </button>
        </div>
      </div>

      {/* Shipping method */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          {t('checkout.shippingMethod')}
        </h3>
        <ShippingOptions
          options={[]}
          selectedId={shippingOptionId || undefined}
          onSelect={onSelectShipping}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; {t('checkout.returnToInformation')}
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="w-full sm:w-auto px-8 py-3 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
        >
          {t('checkout.continueToPayment')}
        </button>
      </div>
    </div>
  );
}
