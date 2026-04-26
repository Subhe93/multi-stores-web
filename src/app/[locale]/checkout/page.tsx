'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

interface ShippingForm {
  first_name: string;
  last_name: string;
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  phone: string;
}

interface AddressResponse {
  id: string;
}

interface OrderResponse {
  id: string;
  order_number: string;
}

const INITIAL_FORM: ShippingForm = {
  first_name: '',
  last_name: '',
  line1: '',
  city: '',
  state: '',
  postal_code: '',
  country_code: '',
  phone: '',
};

export default function CheckoutPage() {
  const t = useTranslations('checkout');
  const tCart = useTranslations('cart');
  const router = useRouter();
  const { token } = useAuth();
  const { items: cartItems, subtotal, coupon, applyCoupon, removeCoupon, clearCart } = useCart();
  const [form, setForm] = useState<ShippingForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [shippingEstimate, setShippingEstimate] = useState<{ min: number; max: number } | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');

  const currency = cartItems[0]?.currency || 'EUR';
  const effectiveShipping = coupon?.freeShipping ? 0 : (shippingCost ?? 0);
  const discount = coupon
    ? coupon.type === 'percentage'
      ? subtotal * (coupon.discount / 100)
      : coupon.discount
    : 0;
  const total = subtotal + effectiveShipping - discount;

  async function handleApplyCoupon() {
    const code = couponCode.trim();
    if (!code) return;
    setCouponError('');
    setCouponLoading(true);
    try {
      await applyCoupon(code);
      setCouponCode('');
    } catch {
      setCouponError(tCart('couponInvalid'));
    } finally {
      setCouponLoading(false);
    }
  }

  // Calculate shipping when country changes
  useEffect(() => {
    const code = form.country_code.trim().toUpperCase();
    if (code.length !== 2 || cartItems.length === 0) {
      setShippingCost(null);
      setShippingEstimate(null);
      setShippingError('');
      return;
    }
    const productIds = cartItems.map((i) => i.productId).filter(Boolean);
    if (productIds.length === 0) return;

    setShippingLoading(true);
    setShippingError('');
    api<any>('/shipping/estimate', {
      method: 'POST',
      body: JSON.stringify({
        product_ids: productIds,
        country_code: code,
        item_count: cartItems.reduce((s, i) => s + i.quantity, 0),
        subtotal,
      }),
    })
      .then((res) => {
        if (!res.available) {
          setShippingError(res.message || 'Shipping not available');
          setShippingCost(null);
          setShippingEstimate(null);
        } else {
          setShippingCost(res.cost);
          setShippingEstimate(res.estimated_days || null);
          setShippingError('');
        }
      })
      .catch(() => setShippingError('Shipping not available'))
      .finally(() => setShippingLoading(false));
  }, [form.country_code, cartItems.length, subtotal]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!token) {
      router.push('/auth/login');
      return;
    }

    try {
      const fullName = `${form.first_name} ${form.last_name}`.trim();
      const address = await api<AddressResponse>('/customers/me/addresses', {
        method: 'POST',
        token,
        body: JSON.stringify({
          full_name: fullName,
          line1: form.line1,
          city: form.city,
          state: form.state || undefined,
          postal_code: form.postal_code,
          country_code: form.country_code,
          phone: form.phone || undefined,
        }),
      });

      const order = await api<OrderResponse>('/orders', {
        method: 'POST',
        token,
        body: JSON.stringify({
          address_id: address.id,
          payment_method: 'COD',
          ...(coupon?.code ? { coupon_code: coupon.code } : {}),
        }),
      });

      await clearCart();
      router.push(`/checkout/confirmation?orderId=${order.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to place order. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-semibold text-slate-800 mb-8">{t('title')}</h1>

          {cartItems.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-slate-500 mb-4">{tCart('empty')}</p>
              <Link
                href="/products"
                className="inline-block rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-700 transition"
              >
                {tCart('continueShopping')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Shipping Address Form */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-6">{t('shippingAddress')}</h2>

                  {error && (
                    <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="first_name" className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('firstName')}
                      </label>
                      <input
                        id="first_name"
                        name="first_name"
                        type="text"
                        required
                        value={form.first_name}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label htmlFor="last_name" className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('lastName')}
                      </label>
                      <input
                        id="last_name"
                        name="last_name"
                        type="text"
                        required
                        value={form.last_name}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="line1" className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('address')}
                      </label>
                      <input
                        id="line1"
                        name="line1"
                        type="text"
                        required
                        value={form.line1}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label htmlFor="city" className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('city')}
                      </label>
                      <input
                        id="city"
                        name="city"
                        type="text"
                        required
                        value={form.city}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label htmlFor="state" className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('state')}
                      </label>
                      <input
                        id="state"
                        name="state"
                        type="text"
                        value={form.state}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label htmlFor="postal_code" className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('postalCode')}
                      </label>
                      <input
                        id="postal_code"
                        name="postal_code"
                        type="text"
                        required
                        value={form.postal_code}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
                      />
                    </div>
                    <div>
                      <label htmlFor="country_code" className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('country')}
                      </label>
                      <input
                        id="country_code"
                        name="country_code"
                        type="text"
                        required
                        maxLength={2}
                        value={form.country_code}
                        onChange={handleChange}
                        placeholder="DE"
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                        {t('phone')}
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={form.phone}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
                      />
                    </div>
                  </div>

                  {/* Coupon code */}
                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {tCart('applyCoupon')}
                    </label>
                    {coupon ? (
                      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3.5 py-2.5">
                        <span className="text-sm font-medium text-green-700 flex-1">{coupon.code}</span>
                        <button
                          type="button"
                          onClick={() => removeCoupon()}
                          className="text-xs text-green-600 hover:text-green-800 font-medium"
                        >
                          {tCart('remove')}
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApplyCoupon())}
                          placeholder={tCart('couponPlaceholder')}
                          className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent transition"
                        />
                        <button
                          type="button"
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 transition"
                        >
                          {couponLoading ? '...' : tCart('apply')}
                        </button>
                      </div>
                    )}
                    {couponError && (
                      <p className="mt-1.5 text-xs text-red-600">{couponError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Order Summary Sidebar */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">{t('orderSummary')}</h2>

                  <div className="space-y-3 mb-6">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        {(item.imageUrl || item.image) && (
                          <img
                            src={item.imageUrl || item.image}
                            alt={item.title || item.name || 'Product'}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {item.title || item.name || 'Product'}
                          </p>
                          <p className="text-xs text-slate-500">{tCart('quantity')}: {item.quantity}</p>
                        </div>
                        <p className="text-sm font-medium text-slate-800">
                          {new Intl.NumberFormat('en', { style: 'currency', currency }).format(item.price * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-200 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{tCart('subtotal')}</span>
                      <span className="text-slate-800">
                        {new Intl.NumberFormat('en', { style: 'currency', currency }).format(subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">{tCart('shipping')}</span>
                      <span className={effectiveShipping === 0 ? 'text-green-600' : 'text-slate-800'}>
                        {shippingLoading ? '...'
                          : coupon?.freeShipping ? tCart('free')
                          : shippingCost === null ? tCart('calculatedAtCheckout')
                          : shippingCost === 0 ? tCart('free')
                          : new Intl.NumberFormat('en', { style: 'currency', currency }).format(shippingCost)}
                      </span>
                    </div>
                    {shippingError && (
                      <p className="text-xs text-red-600">{shippingError}</p>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>{tCart('discount')}</span>
                        <span>-{new Intl.NumberFormat('en', { style: 'currency', currency }).format(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-semibold border-t border-slate-200 pt-2">
                      <span className="text-slate-800">{tCart('total')}</span>
                      <span className="text-slate-800">
                        {new Intl.NumberFormat('en', { style: 'currency', currency }).format(total)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !!shippingError || shippingLoading}
                    className="mt-6 w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {loading ? t('processing') : t('placeOrder')}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
