import type { GuestRegisterData, RegisterData } from '@/hooks/useAuth';

/** Session key marking an order placed by a freshly created guest account,
 *  so the confirmation page can say what was emailed. Value: the email. */
export function guestAccountNoteKey(orderId: string): string {
  return `checkout_guest_account:${orderId}`;
}

export interface CheckoutAccountInput {
  /** Shopper ticked "create an account" and typed their own password. */
  wantAccount: boolean;
  password: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  storeSlug?: string;
  hostname?: string;
  locale?: string;
}

export interface CheckoutAccountDeps {
  register: (data: RegisterData) => Promise<string>;
  registerGuest: (data: GuestRegisterData) => Promise<string>;
}

/**
 * Create the customer account a guest checkout needs and resolve with its
 * access token. With a chosen password it calls /auth/register; otherwise
 * /auth/guest-register, where the server generates the password and emails
 * it with a one-click login link. Both carry the store context so the email
 * is branded and localized. Errors propagate to the caller unchanged.
 */
export async function createCheckoutAccount(
  input: CheckoutAccountInput,
  deps: CheckoutAccountDeps,
): Promise<{ token: string; guest: boolean }> {
  const context = {
    store_slug: input.storeSlug || undefined,
    hostname: input.hostname || undefined,
    locale: input.locale || undefined,
  };
  const profile = {
    email: input.email,
    first_name: input.first_name || undefined,
    last_name: input.last_name || undefined,
    phone: input.phone || undefined,
  };

  if (input.wantAccount && input.password.length >= 8) {
    const token = await deps.register({
      ...profile,
      password: input.password,
      role: 'CUSTOMER',
      ...context,
    });
    return { token, guest: false };
  }

  const token = await deps.registerGuest({ ...profile, ...context });
  return { token, guest: true };
}
