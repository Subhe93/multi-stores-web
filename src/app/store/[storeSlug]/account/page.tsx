'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLocalePath } from '@/hooks/useLocalePath';
import { api } from '@/lib/api';
import { IfApp } from '@/components/IfApp';
import { useStoreApp } from '@/hooks/useStoreApps';
import { Package, MapPin, Pencil, Loader2, Lock, Check, Building2 } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  avatar_url?: string;
  customer?: {
    first_name: string;
    last_name: string;
    phone?: string;
    /** b2b app: company defaults used to prefill checkout (M2-DESIGN D8). */
    customer_type?: 'PERSON' | 'COMPANY' | null;
    company_name?: string | null;
    org_number?: string | null;
    vat_number?: string | null;
  };
}

type BuyerTypeValue = 'PERSON' | 'COMPANY';

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition';

export default function StoreAccountPage() {
  const t = useTranslations('account');
  const tCommon = useTranslations('common');
  const tB2b = useTranslations('b2b');
  const lp = useLocalePath();
  // b2b app: the company fieldset is rendered (and its fields sent) only when
  // the store has the app, so the PUT body stays identical elsewhere.
  const b2bEnabled = Boolean(useStoreApp('b2b'));

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile edit state
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: '', last_name: '', phone: '',
    customer_type: 'PERSON' as BuyerTypeValue, company_name: '', org_number: '', vat_number: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Password change state
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');

  function getToken() {
    return localStorage.getItem('auth_access_token');
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api<UserProfile>('/auth/me', { token })
      .then((data) => {
        setUser(data);
        if (data.customer) {
          setProfileForm({
            first_name: data.customer.first_name || '',
            last_name: data.customer.last_name || '',
            phone: data.customer.phone || '',
            customer_type: data.customer.customer_type === 'COMPANY' ? 'COMPANY' : 'PERSON',
            company_name: data.customer.company_name || '',
            org_number: data.customer.org_number || '',
            vat_number: data.customer.vat_number || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setProfileSaving(true);
    setProfileMsg('');
    try {
      await api('/customers/me', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
          phone: profileForm.phone || undefined,
          // b2b app: company defaults (PUT /customers/me, M2-DESIGN §4.5).
          // Saving as PERSON clears the company defaults (null accepted by the API).
          ...(b2bEnabled
            ? profileForm.customer_type === 'COMPANY'
              ? {
                  customer_type: 'COMPANY',
                  company_name: profileForm.company_name.trim() || null,
                  org_number: profileForm.org_number.trim() || null,
                  vat_number: profileForm.vat_number.trim() || null,
                }
              : { customer_type: 'PERSON', company_name: null, org_number: null, vat_number: null }
            : {}),
        }),
      });
      setUser((prev) =>
        prev
          ? {
              ...prev,
              customer: {
                ...prev.customer,
                first_name: profileForm.first_name,
                last_name: profileForm.last_name,
                phone: profileForm.phone || undefined,
                ...(b2bEnabled
                  ? profileForm.customer_type === 'COMPANY'
                    ? {
                        customer_type: 'COMPANY' as const,
                        company_name: profileForm.company_name.trim() || null,
                        org_number: profileForm.org_number.trim() || null,
                        vat_number: profileForm.vat_number.trim() || null,
                      }
                    : { customer_type: 'PERSON' as const, company_name: null, org_number: null, vat_number: null }
                  : {}),
              },
            }
          : prev,
      );
      setEditing(false);
      setProfileMsg(t('profileUpdated'));
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err: unknown) {
      setProfileMsg(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwdError('');
    setPwdMsg('');

    if (pwdForm.new_password.length < 8) {
      setPwdError('Password must be at least 8 characters');
      return;
    }
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      setPwdError('Passwords do not match');
      return;
    }

    const token = getToken();
    if (!token) return;
    setPwdSaving(true);

    try {
      await api('/auth/change-password', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          current_password: pwdForm.current_password,
          new_password: pwdForm.new_password,
        }),
      });
      setPwdMsg(t('passwordChanged'));
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
      setShowPwdForm(false);
      setTimeout(() => setPwdMsg(''), 3000);
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwdSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="store-surface store-bd rounded-2xl border p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-100 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
    );
  }

  const name = user?.customer
    ? `${user.customer.first_name} ${user.customer.last_name}`.trim()
    : user?.email?.split('@')[0] || '';

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="store-surface store-bd rounded-2xl border p-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-lg font-semibold text-gray-900">{t('title')}</h1>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
            >
              <Pencil className="w-3.5 h-3.5" /> {tCommon('edit')}
            </button>
          )}
        </div>

        {profileMsg && (
          <div className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <Check className="w-4 h-4" /> {profileMsg}
          </div>
        )}

        {editing ? (
          <form onSubmit={handleProfileSave} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('firstName')}</label>
                <input
                  required
                  value={profileForm.first_name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, first_name: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('lastName')}</label>
                <input
                  required
                  value={profileForm.last_name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, last_name: e.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('phone')}</label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                className={inputCls}
              />
            </div>

            {/* Company defaults — b2b app only */}
            <IfApp app="b2b">
              <fieldset className="border-t border-gray-100 pt-3 mt-1 space-y-3">
                <legend className="text-xs font-semibold text-gray-900 flex items-center gap-1.5 pt-3">
                  <Building2 className="w-3.5 h-3.5 text-gray-500" /> {t('companyDefaults')}
                </legend>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('buyerType')}</label>
                  <select
                    value={profileForm.customer_type}
                    onChange={(e) => setProfileForm((p) => ({ ...p, customer_type: e.target.value === 'COMPANY' ? 'COMPANY' : 'PERSON' }))}
                    className={inputCls}
                  >
                    <option value="PERSON">{tB2b('person')}</option>
                    <option value="COMPANY">{tB2b('company')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{tB2b('companyName')}</label>
                  <input
                    value={profileForm.company_name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, company_name: e.target.value }))}
                    className={inputCls}
                    autoComplete="organization"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{tB2b('orgNumber')}</label>
                    <input
                      value={profileForm.org_number}
                      onChange={(e) => setProfileForm((p) => ({ ...p, org_number: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{tB2b('vatNumber')}</label>
                    <input
                      value={profileForm.vat_number}
                      onChange={(e) => setProfileForm((p) => ({ ...p, vat_number: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                </div>
              </fieldset>
            </IfApp>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
                style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
              >
                {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {tCommon('save')}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                {tCommon('cancel')}
              </button>
            </div>
          </form>
        ) : (
          user && (
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
                style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{name}</h2>
                <p className="text-sm text-gray-500">{user.email}</p>
                {user.customer?.phone && <p className="text-sm text-gray-500">{user.customer.phone}</p>}
                {/* Company defaults — b2b app only */}
                <IfApp app="b2b">
                  {user.customer?.customer_type === 'COMPANY' && (
                    <div className="mt-2 text-sm text-gray-600 space-y-0.5">
                      <p className="text-xs font-semibold text-gray-900 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-500" /> {t('companyDefaults')}
                      </p>
                      {user.customer.company_name && <p>{user.customer.company_name}</p>}
                      {user.customer.org_number && <p>{tB2b('orgNumber')}: {user.customer.org_number}</p>}
                      {user.customer.vat_number && <p>{tB2b('vatNumber')}: {user.customer.vat_number}</p>}
                    </div>
                  )}
                </IfApp>
              </div>
            </div>
          )
        )}
      </div>

      {/* Change password */}
      <div className="store-surface store-bd rounded-2xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-500" /> {t('changePassword')}
          </h2>
          {!showPwdForm && (
            <button
              onClick={() => setShowPwdForm(true)}
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--store-primary, #2563eb)' }}
            >
              {tCommon('edit')}
            </button>
          )}
        </div>

        {pwdMsg && (
          <div className="mb-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <Check className="w-4 h-4" /> {pwdMsg}
          </div>
        )}

        {showPwdForm ? (
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('currentPassword')}</label>
              <input
                type="password"
                required
                value={pwdForm.current_password}
                onChange={(e) => setPwdForm((p) => ({ ...p, current_password: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('newPassword')}</label>
              <input
                type="password"
                required
                minLength={8}
                value={pwdForm.new_password}
                onChange={(e) => setPwdForm((p) => ({ ...p, new_password: e.target.value }))}
                placeholder={t('minPasswordChars')}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('confirmPassword')}</label>
              <input
                type="password"
                required
                value={pwdForm.confirm_password}
                onChange={(e) => setPwdForm((p) => ({ ...p, confirm_password: e.target.value }))}
                className={inputCls}
              />
            </div>
            {pwdError && (
              <p className="text-sm text-red-600">{pwdError}</p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={pwdSaving}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition flex items-center gap-2"
                style={{ backgroundColor: 'var(--store-primary, #2563eb)' }}
              >
                {pwdSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('changePassword')}
              </button>
              <button
                type="button"
                onClick={() => { setShowPwdForm(false); setPwdError(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition"
              >
                {tCommon('cancel')}
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-gray-500">••••••••</p>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href={lp('/account/orders')}
          className="store-surface store-bd rounded-2xl border p-5 hover:border-gray-300 hover:shadow-sm transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
              <Package className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{t('orders')}</h3>
              <p className="text-xs text-gray-500">{t('viewDetails')}</p>
            </div>
          </div>
        </Link>

        <Link
          href={lp('/account/addresses')}
          className="store-surface store-bd rounded-2xl border p-5 hover:border-gray-300 hover:shadow-sm transition group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">{t('addresses')}</h3>
              <p className="text-xs text-gray-500">{t('addAddress')}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
