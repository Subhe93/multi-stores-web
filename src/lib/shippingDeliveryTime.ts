// Web copy of the API's nameStatesDeliveryTime (kustom.mapper.ts). Keep the
// two regexes identical: the Kustom iframe and the classic checkout must agree
// on when a method name already states a delivery time.

// A number (or range) followed by a day word in any storefront language:
// "2–4 arbetsdagar", "1-3 days", "3 Werktage", "2 à 4 jours", "2-4 iş günü",
// "٣ أيام". Matching is deliberately loose: a false positive only drops the
// extra estimate line, a false negative shows a second delivery time.
const DELIVERY_TIME_IN_NAME =
  /[0-9٠-٩]+\s*(?:(?:[–—-]|to|till|bis|à|ile)\s*[0-9٠-٩]+\s*)?(?:business\s+|working\s+|iş\s+)?(?:days?|dag(?:ar)?|arbetsdag(?:ar)?|vardag(?:ar)?|werktag(?:e|en)?|tag(?:e|en)?|jours?|gün|يوم|أيام)/i;

/** True when a shipping method's own name already states a delivery time. */
export function nameStatesDeliveryTime(name: string | null | undefined): boolean {
  return Boolean(name) && DELIVERY_TIME_IN_NAME.test(name as string);
}
