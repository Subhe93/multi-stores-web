'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';

export type CheckoutStep = 'information' | 'shipping' | 'payment';

interface CheckoutStepsProps {
  current: CheckoutStep;
  onGoTo?: (step: CheckoutStep) => void;
}

const STEPS: CheckoutStep[] = ['information', 'shipping', 'payment'];

export function CheckoutSteps({ current, onGoTo }: CheckoutStepsProps) {
  const t = useTranslations('checkout');
  const currentIdx = STEPS.indexOf(current);

  const labels: Record<CheckoutStep, string> = {
    information: t('information'),
    shipping: t('shipping'),
    payment: t('payment'),
  };

  return (
    <nav className="flex items-center justify-center gap-0 mb-8" aria-label="Checkout steps">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;
        const isClickable = isCompleted && onGoTo;

        return (
          <div key={step} className="flex items-center">
            {/* Step indicator */}
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onGoTo(step)}
              className={`flex items-center gap-2 px-1 py-1 transition-colors ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              }`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {/* Circle */}
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                  isCompleted
                    ? 'text-white'
                    : isCurrent
                      ? 'text-white'
                      : 'bg-gray-200 text-gray-400'
                }`}
                style={
                  isCompleted || isCurrent
                    ? { backgroundColor: 'var(--store-primary, #2563eb)' }
                    : undefined
                }
              >
                {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
              </span>

              {/* Label */}
              <span
                className={`text-sm font-medium hidden sm:inline ${
                  isCurrent
                    ? 'text-gray-900'
                    : isCompleted
                      ? 'text-gray-600'
                      : 'text-gray-400'
                }`}
              >
                {labels[step]}
              </span>
            </button>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <div
                className={`w-8 sm:w-12 h-px mx-1 ${
                  idx < currentIdx ? 'bg-[var(--store-primary,#2563eb)]' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
