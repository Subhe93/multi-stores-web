/**
 * Form validators for checkout fields.
 * Each function returns an i18n translation key on failure, or null on success.
 */

export function validateEmail(value: string): string | null {
  if (!value.trim()) return 'checkout.errors.emailRequired';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'checkout.errors.emailInvalid';
  return null;
}

export function validateRequired(value: string, field: string): string | null {
  if (!value.trim()) {
    const keyMap: Record<string, string> = {
      full_name: 'checkout.errors.nameRequired',
      line1: 'checkout.errors.addressRequired',
      city: 'checkout.errors.cityRequired',
      postal_code: 'checkout.errors.postalCodeRequired',
      country_code: 'checkout.errors.countryRequired',
    };
    return keyMap[field] || 'checkout.errors.fieldRequired';
  }
  return null;
}

export function validatePhone(value: string): string | null {
  if (value.trim() && !/^[+\d\s\-()]{6,20}$/.test(value.trim())) {
    return 'checkout.errors.phoneInvalid';
  }
  return null;
}
