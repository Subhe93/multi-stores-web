'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { X, ShoppingCart } from 'lucide-react';
import { useLocalePath } from '@/hooks/useLocalePath';
import { useCart } from '@/hooks/useCart';
import { CartItem } from './CartItem';
import { CartSummary } from './CartSummary';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const t = useTranslations();
  const lp = useLocalePath();
  const { items, itemCount, subtotal, total, coupon, updateQuantity, removeItem } = useCart();

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const currency = items[0]?.currency || 'EUR'; // currency inherited from platform config via cart API

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              {t('cart.title')} ({itemCount})
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50"
              aria-label="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart content */}
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: 'color-mix(in srgb, var(--store-primary, #2563eb) 10%, white)' }}
              >
                <ShoppingCart
                  className="w-7 h-7"
                  style={{ color: 'var(--store-primary, #2563eb)' }}
                />
              </div>
              <p className="text-gray-500 text-sm mb-6">{t('cart.empty')}</p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
              >
                {t('cart.continueShopping')}
              </button>
            </div>
          ) : (
            <>
              {/* Items list */}
              <div className="flex-1 overflow-y-auto px-6">
                {items.map((item) => (
                  <CartItem
                    key={item.id}
                    item={{
                      id: item.id,
                      productId: item.productId,
                      title: item.title || item.name || 'Product',
                      price: item.price,
                      quantity: item.quantity,
                      imageUrl: item.imageUrl || item.image,
                      variant: item.variant,
                      customFields: item.customFields,
                      customerFile: item.customerFile,
                      currency: item.currency,
                    }}
                    onUpdateQuantity={(id, qty) => updateQuantity(id, qty)}
                    onRemove={(id) => removeItem(id)}
                  />
                ))}
              </div>

              {/* Footer with summary */}
              <div className="border-t px-6 py-4 space-y-4">
                {coupon && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-600 font-medium">{t('cart.couponApplied')}: {coupon.code}</span>
                  </div>
                )}
                <CartSummary
                  subtotal={subtotal}
                  discount={coupon ? (coupon.type === 'percentage' ? subtotal * (coupon.discount / 100) : coupon.discount) : undefined}
                  total={total}
                  currency={currency}
                />
                <Link
                  href={lp('/checkout')}
                  onClick={onClose}
                  className="block w-full py-3 text-white text-sm font-semibold text-center rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
                >
                  {t('cart.checkout')}
                </Link>
                <button
                  onClick={onClose}
                  className="block w-full py-2.5 text-sm font-medium text-gray-500 text-center hover:text-gray-900 transition-colors"
                >
                  {t('cart.continueShopping')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
