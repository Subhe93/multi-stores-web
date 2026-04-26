'use client';

import { useTranslations } from 'next-intl';
import { CardElement } from '@stripe/react-stripe-js';
import type { StripeCardElementChangeEvent } from '@stripe/stripe-js';

interface PaymentFormProps {
  selectedMethod: 'cod' | 'stripe';
  onMethodChange: (method: 'cod' | 'stripe') => void;
  stripeAvailable: boolean;
  onStripeReady?: (ready: boolean) => void;
}

export function PaymentForm({
  selectedMethod,
  onMethodChange,
  stripeAvailable,
  onStripeReady,
}: PaymentFormProps) {
  const t = useTranslations();

  function handleCardChange(event: StripeCardElementChangeEvent) {
    onStripeReady?.(event.complete && !event.error);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-6">
        {t('checkout.paymentMethod')}
      </h2>

      <div className="space-y-3">
        {/* Cash on Delivery */}
        <button
          type="button"
          onClick={() => onMethodChange('cod')}
          className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
            selectedMethod === 'cod'
              ? 'border-blue-600 bg-blue-50'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selectedMethod === 'cod' ? 'border-blue-600' : 'border-slate-400'
              }`}
            >
              {selectedMethod === 'cod' && (
                <div className="w-2 h-2 rounded-full bg-blue-600" />
              )}
            </div>

            <svg
              className="w-5 h-5 text-slate-600 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
              />
            </svg>

            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800">
                {t('checkout.cashOnDelivery')}
              </p>
              <p className="text-xs text-slate-500">
                {t('checkout.codDescription')}
              </p>
            </div>
          </div>
        </button>

        {/* Credit / Debit Card (Stripe) */}
        {stripeAvailable ? (
          <div>
            <button
              type="button"
              onClick={() => onMethodChange('stripe')}
              className={`w-full rounded-lg border-2 p-4 text-left transition-colors ${
                selectedMethod === 'stripe'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedMethod === 'stripe' ? 'border-blue-600' : 'border-slate-400'
                  }`}
                >
                  {selectedMethod === 'stripe' && (
                    <div className="w-2 h-2 rounded-full bg-blue-600" />
                  )}
                </div>

                <svg
                  className="w-5 h-5 text-slate-600 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
                  />
                </svg>

                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {t('checkout.creditCard')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t('checkout.stripeDescription')}
                  </p>
                </div>
              </div>
            </button>

            {/* Stripe CardElement - shown when Stripe is selected */}
            {selectedMethod === 'stripe' && (
              <div className="mt-3 rounded-lg border border-slate-200 p-4 bg-white">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '14px',
                        color: '#1e293b',
                        '::placeholder': { color: '#94a3b8' },
                      },
                      invalid: { color: '#ef4444' },
                    },
                  }}
                  onChange={handleCardChange}
                />
              </div>
            )}
          </div>
        ) : (
          // Stripe not configured - show disabled option
          <div className="w-full rounded-lg border-2 border-slate-100 bg-slate-50 p-4 opacity-60 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />

              <svg
                className="w-5 h-5 text-slate-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
                />
              </svg>

              <div className="flex-1">
                <p className="text-sm font-medium text-slate-400">
                  {t('checkout.creditCard')}
                </p>
                <p className="text-xs text-slate-400">
                  {t('checkout.stripeNotConfigured')}
                </p>
              </div>

              <span className="text-xs font-medium text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                Coming soon
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
