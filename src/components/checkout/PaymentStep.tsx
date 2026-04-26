'use client';

import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { PaymentForm } from './PaymentForm';
import { CouponInput } from '@/components/cart/CouponInput';
import type { ShippingForm } from './AddressForm';

interface PaymentStepProps {
  form: ShippingForm;
  paymentMethod: 'cod' | 'stripe';
  onPaymentMethodChange: (method: 'cod' | 'stripe') => void;
  stripeAvailable: boolean;
  onStripeReady: (ready: boolean) => void;
  couponCode: string;
  appliedCoupon?: string;
  onApplyCoupon: (code: string) => void;
  onRemoveCoupon: () => void;
  couponLoading?: boolean;
  couponError?: string;
  loading: boolean;
  error: string;
  onSubmit: () => void;
  onBackToShipping: () => void;
  onBackToInfo: () => void;
}

export function PaymentStep({
  form,
  paymentMethod,
  onPaymentMethodChange,
  stripeAvailable,
  onStripeReady,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  couponLoading,
  couponError,
  loading,
  error,
  onSubmit,
  onBackToShipping,
  onBackToInfo,
}: PaymentStepProps) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      {/* Address + shipping summary */}
      <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        {/* Contact */}
        <div className="flex items-center justify-between p-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 w-16 shrink-0">{t('checkout.email')}</span>
            <span className="text-gray-700">{form.email || '—'}</span>
          </div>
          <button
            type="button"
            onClick={onBackToInfo}
            className="text-sm font-medium shrink-0"
            style={{ color: 'var(--store-primary, #2563eb)' }}
          >
            {t('common.edit')}
          </button>
        </div>
        {/* Address */}
        <div className="flex items-center justify-between p-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 w-16 shrink-0">{t('checkout.address')}</span>
            <span className="text-gray-700">
              {form.line1}, {form.city} {form.postal_code}
            </span>
          </div>
          <button
            type="button"
            onClick={onBackToInfo}
            className="text-sm font-medium shrink-0"
            style={{ color: 'var(--store-primary, #2563eb)' }}
          >
            {t('common.edit')}
          </button>
        </div>
        {/* Shipping method */}
        <div className="flex items-center justify-between p-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 w-16 shrink-0">{t('checkout.shipping')}</span>
            <span className="text-gray-700">Standard Shipping</span>
          </div>
          <button
            type="button"
            onClick={onBackToShipping}
            className="text-sm font-medium shrink-0"
            style={{ color: 'var(--store-primary, #2563eb)' }}
          >
            {t('common.edit')}
          </button>
        </div>
      </div>

      {/* Payment method */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">
          {t('checkout.paymentMethod')}
        </h3>
        <PaymentForm
          selectedMethod={paymentMethod}
          onMethodChange={onPaymentMethodChange}
          stripeAvailable={stripeAvailable}
          onStripeReady={onStripeReady}
        />
      </div>

      {/* Coupon */}
      <div className="pt-2">
        <CouponInput
          onApply={onApplyCoupon}
          appliedCoupon={appliedCoupon}
          onRemove={onRemoveCoupon}
          loading={couponLoading}
          error={couponError}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Trust badge */}
      <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
        <Lock className="w-3.5 h-3.5" />
        <span>{t('checkout.allTransactionsSecure')}</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBackToShipping}
          className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; {t('checkout.returnToShipping')}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || (paymentMethod === 'stripe' && !stripeAvailable)}
          className="w-full sm:w-auto px-8 py-3.5 text-white text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('checkout.processing')}
            </>
          ) : paymentMethod === 'stripe' ? (
            t('checkout.payAndPlaceOrder')
          ) : (
            t('checkout.completeOrder')
          )}
        </button>
      </div>
    </div>
  );
}
