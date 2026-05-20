'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface Address {
  id: string;
  full_name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country_code: string;
  phone?: string;
  is_default?: boolean;
}

const COUNTRIES = [
  { code: 'DE', name: 'Germany' }, { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'FR', name: 'France' },
  { code: 'TR', name: 'Turkey' }, { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'SE', name: 'Sweden' },
  { code: 'NL', name: 'Netherlands' }, { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' }, { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' }, { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' }, { code: 'EG', name: 'Egypt' },
  { code: 'JO', name: 'Jordan' }, { code: 'KW', name: 'Kuwait' },
  { code: 'QA', name: 'Qatar' }, { code: 'BH', name: 'Bahrain' },
  { code: 'OM', name: 'Oman' }, { code: 'IQ', name: 'Iraq' },
  { code: 'LB', name: 'Lebanon' },
];

const EMPTY_FORM = {
  full_name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country_code: '',
  phone: '',
};

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition';

export default function StoreAddressesPage() {
  const t = useTranslations('account');
  const tCheckout = useTranslations('checkout');

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  function getToken() {
    return localStorage.getItem('auth_access_token');
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api<Address[]>('/customers/me/addresses', { token })
      .then((data) => setAddresses(Array.isArray(data) ? data : []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load addresses'))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSaving(true);
    setError('');

    try {
      const newAddr = await api<Address>('/customers/me/addresses', {
        method: 'POST',
        token,
        body: JSON.stringify({
          full_name: form.full_name,
          line1: form.line1,
          line2: form.line2 || undefined,
          city: form.city,
          state: form.state || undefined,
          postal_code: form.postal_code,
          country_code: form.country_code,
          phone: form.phone || undefined,
        }),
      });
      setAddresses((prev) => [...prev, newAddr]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add address');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const token = getToken();
    if (!token) return;
    setDeleting(id);
    try {
      await api(`/customers/me/addresses/${id}`, { method: 'DELETE', token });
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete address');
    } finally {
      setDeleting(null);
    }
  }

  const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name || code;

  if (loading) {
    return (
      <div className="store-surface store-bd rounded-2xl border p-8">
        <div className="animate-pulse space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="store-surface store-bd rounded-2xl border p-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">{t('addresses')}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition"
          style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
        >
          <Plus className="w-4 h-4" />
          {showForm ? tCheckout('cancel') : t('addAddress')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="store-surface store-bd rounded-2xl border p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">{t('addAddress')}</h2>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">{tCheckout('firstName')} & {tCheckout('lastName')}</label>
              <input name="full_name" required value={form.full_name} onChange={handleChange}
                placeholder="John Doe" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">{tCheckout('address')}</label>
              <input name="line1" required value={form.line1} onChange={handleChange}
                placeholder={tCheckout('address')} className={inputCls} />
              <input name="line2" value={form.line2} onChange={handleChange}
                placeholder="Apartment, suite, etc. (optional)" className={`mt-2 ${inputCls}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tCheckout('city')}</label>
              <input name="city" required value={form.city} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tCheckout('state')}</label>
              <input name="state" value={form.state} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tCheckout('postalCode')}</label>
              <input name="postal_code" required value={form.postal_code} onChange={handleChange} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{tCheckout('country')}</label>
              <select name="country_code" required value={form.country_code} onChange={handleChange} className={inputCls}>
                <option value="">{tCheckout('country')}...</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">{tCheckout('phone')}</label>
              <input name="phone" type="tel" value={form.phone} onChange={handleChange} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
                style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? tCheckout('processing') : t('addAddress')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Address cards */}
      {addresses.length === 0 && !showForm ? (
        <div className="store-surface store-bd rounded-2xl border p-8 text-center">
          <p className="text-sm text-gray-500">No saved addresses yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div key={addr.id} className="store-surface store-bd rounded-2xl border p-5">
              <div className="flex items-start justify-between">
                <div className="text-sm text-gray-600 space-y-0.5">
                  <p className="font-medium text-gray-900">{addr.full_name}</p>
                  <p>{addr.line1}</p>
                  {addr.line2 && <p>{addr.line2}</p>}
                  <p>
                    {[addr.city, addr.state].filter(Boolean).join(', ')}{' '}
                    {addr.postal_code}
                  </p>
                  <p>{countryName(addr.country_code)}</p>
                  {addr.phone && <p className="text-gray-400">{addr.phone}</p>}
                </div>
                <button
                  onClick={() => handleDelete(addr.id)}
                  disabled={deleting === addr.id}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-50 transition p-1"
                  title="Delete"
                >
                  {deleting === addr.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
