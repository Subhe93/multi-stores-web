import { describe, expect, it } from 'vitest';
import { nameStatesDeliveryTime } from './shippingDeliveryTime';

// Same cases as the API's kustom.mapper.spec (nameStatesDeliveryTime).
describe('nameStatesDeliveryTime', () => {
  it('detects a delivery time already stated in the method name', () => {
    for (const name of [
      'Standardfrakt (Skickas inom 2–4 arbetsdagar)',
      'Express 1-2 dagar',
      'Standard shipping (3–5 business days)',
      'Delivery in 2 days',
      'Versand 2 bis 4 Werktage',
      'Livraison 2 à 4 jours',
      'Standart kargo 2-4 iş günü',
      'شحن عادي ٣ أيام',
    ]) {
      expect(nameStatesDeliveryTime(name)).toBe(true);
    }
  });

  it('is false for names without a delivery time', () => {
    for (const name of ['Standardfrakt', 'PostNord MyPack 2.0', 'DHL Express', '', null, undefined]) {
      expect(nameStatesDeliveryTime(name)).toBe(false);
    }
  });
});
