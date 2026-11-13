import type { LocalizedString } from '../../../types';

/** Alignment choices shared by the container schemas. */
export const ALIGN_OPTIONS: { value: string; label: LocalizedString }[] = [
  { value: 'stretch', label: { en: 'Stretch', ar: 'تمدد' } },
  { value: 'start', label: { en: 'Start', ar: 'البداية' } },
  { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
  { value: 'end', label: { en: 'End', ar: 'النهاية' } },
];
