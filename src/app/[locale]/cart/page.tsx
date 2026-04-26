'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCart } from '@/hooks/useCart';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CartItem } from '@/components/cart/CartItem';
import { CartSummary } from '@/components/cart/CartSummary';
import { CouponInput } from '@/components/cart/CouponInput';

export default function CartPage() {
  const t = useTranslations('cart');
  const {
    items,
    loading,
    subtotal,
    total,
    coupon,
    updateQuantity,
    removeItem,
    applyCoupon,
    removeCoupon,
  } = useCart();

  const currency = items[0]?.currency || 'EUR';

  const discount = coupon
    ? coupon.type === 'percentage'
      ? subtotal * (coupon.discount / 100)
      : coupon.discount
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-400 animate-pulse">Loading...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-24 h-24 text-gray-300 mb-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
            />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('empty')}</h1>
          <p className="text-gray-500 mb-8">{t('emptyDescription')}</p>
          <Link
            href="/products"
            className="px-8 py-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            {t('continueShopping')}
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('title')}</h1>

          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            {/* Cart items */}
            <div className="lg:col-span-8">
              <div className="bg-white rounded-xl border p-6">
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

              <div className="mt-4">
                <Link
                  href="/products"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  {t('continueShopping')}
                </Link>
              </div>
            </div>

            {/* Order summary sidebar */}
            <div className="lg:col-span-4 mt-8 lg:mt-0">
              <div className="bg-white rounded-xl border p-6 sticky top-24">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {t('checkout')}
                </h2>

                <CartSummary
                  subtotal={subtotal}
                  discount={discount > 0 ? discount : undefined}
                  total={total}
                  currency={currency}
                />

                <div className="mt-6">
                  <CouponInput
                    onApply={(code) => applyCoupon(code)}
                    appliedCoupon={coupon?.code}
                    onRemove={() => removeCoupon()}
                  />
                </div>

                <Link
                  href="/checkout"
                  className="mt-6 block w-full py-3 bg-gray-900 text-white text-sm font-medium text-center rounded-lg hover:bg-gray-800 transition-colors"
                >
                  {t('checkout')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
