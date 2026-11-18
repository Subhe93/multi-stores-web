/** One section of the demo page: settings plus content in the two demo locales. */
export interface DemoSection {
  section_key: string;
  settings: Record<string, unknown>;
  content: { en: Record<string, unknown>; ar: Record<string, unknown> };
}
