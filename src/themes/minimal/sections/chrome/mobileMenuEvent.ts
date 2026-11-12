// Window event that asks the HeaderBar's mobile drawer to open. Fired by the
// "menu" item of MobileBottomNav; HeaderBarMobileMenu listens and cancels the
// event (preventDefault) to tell the sender it handled it.
export const OPEN_MOBILE_MENU_EVENT = 'store:open-mobile-menu';

/** Ask the mobile drawer to open. Returns true when a drawer handled it. */
export function requestMobileMenu(): boolean {
  const event = new CustomEvent(OPEN_MOBILE_MENU_EVENT, { cancelable: true });
  // dispatchEvent returns false once a listener called preventDefault().
  return !window.dispatchEvent(event);
}
