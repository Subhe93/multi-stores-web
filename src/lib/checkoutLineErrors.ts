/**
 * Errors about one cart line's personalization: M4.0 field rules and uploads,
 * the personalization app's codes (M4.1, e.g. `PERSONALIZATION_INVALID`) and
 * the designer app's (M4.2, e.g. `DESIGNER_DESIGN_LOCKED`). Checkout shows
 * these with the product of the line and a link back to the cart.
 */
export function isLineErrorCode(code: string | undefined | null): code is string {
  return Boolean(code && /^(CUSTOM_FIELD_|CUSTOMER_UPLOAD_|PERSONALIZATION_|DESIGNER_)/.test(code));
}
