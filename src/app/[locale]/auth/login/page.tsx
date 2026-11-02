import { redirect } from 'next/navigation';
import { DASHBOARD_LOGIN_URL } from '@/lib/brand';

// Platform sign-in belongs to the dashboard (a separate origin that keeps
// the session). Store owners and partners land there directly; customers
// sign in on the store they shop in, never here.
export default function LoginPage() {
  redirect(DASHBOARD_LOGIN_URL);
}
