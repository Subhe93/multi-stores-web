// CopyrightBar — the thin strip at the very bottom of the footer with
// copyright text and optional payment-method icons. Auto-substitutes the
// current year and store name when the text contains {year} / {store}.

import type { SectionDefinition, SectionRenderProps } from '../../../types';
import { colorOr } from '../../../elementStyles';

type Alignment = 'start' | 'center' | 'end' | 'between';

function CopyrightBar({ settings, content, locale, storeContext }: SectionRenderProps) {
  const rawText = (content.text as string) || '';
  const storeName = storeContext?.storeName || '';
  const year = new Date().getFullYear();
  // Token substitution — creators write `© {year} {store}` and it auto-fills.
  const text = rawText
    .replace(/\{year\}/gi, String(year))
    .replace(/\{store\}/gi, storeName)
    || `© ${year} ${storeName || ''}`.trim();

  const alignment = (settings.alignment as Alignment) || 'between';
  const bg = colorOr(settings.bg_color, 'var(--theme-colors-surface)');
  const fg = colorOr(settings.text_color, 'var(--theme-colors-muted)');
  const borderColor = colorOr(settings.border_color, 'var(--theme-colors-border)');

  const showPaymentIcons = settings.show_payment_icons === true;
  const paymentMethods = ((content.payment_methods as { label?: string }[]) || [])
    .filter((m) => m.label)
    .map((m) => m.label as string);

  const justify =
    alignment === 'start'
      ? 'justify-start'
      : alignment === 'end'
        ? 'justify-end'
        : alignment === 'center'
          ? 'justify-center'
          : 'justify-between';

  return (
    <div
      style={{
        backgroundColor: bg,
        color: fg,
        borderTop: `1px solid ${borderColor}`,
      }}
    >
      <div
        className={`mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center gap-3 ${justify}`}
        style={{ maxWidth: 'var(--theme-container-max)' }}
      >
        <p className="text-xs">{text}</p>
        {showPaymentIcons && paymentMethods.length > 0 && (
          <div className="flex items-center gap-2">
            {paymentMethods.map((label, i) => (
              <span
                key={i}
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded border"
                style={{
                  borderColor: borderColor,
                  color: fg,
                  backgroundColor: 'var(--theme-colors-background)',
                }}
                title={label}
              >
                {label}
              </span>
            ))}
          </div>
        )}
        {locale === 'ar' ? null : null}
      </div>
    </div>
  );
}

export const copyrightBarSection: SectionDefinition = {
  schema: {
    id: 'copyright-bar',
    label: { en: 'Copyright Bar', ar: 'شريط حقوق النشر' },
    icon: 'copyright',
    category: 'footer',
    description: {
      en: 'Thin bottom strip. Tokens {year} and {store} auto-fill with the current year and store name. Optional payment-method badges on the side.',
      ar: 'شريط سفلي رفيع. الرمزان {year} و {store} يُملآن تلقائياً بالسنة الحالية واسم المتجر. شارات وسائل دفع اختيارية على الجانب.',
    },
    pageTypes: ['FOOTER'],
    translatable: ['text', 'payment_methods'],
    schema: [
      { key: 'text', type: 'text', label: { en: 'Copyright text (use {year} and {store})', ar: 'نص حقوق النشر (استخدم {year} و {store})' } },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'between',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
          { value: 'between', label: { en: 'Space between (text ↔ icons)', ar: 'موزّع (نص ↔ أيقونات)' } },
        ],
      },
      { key: 'show_payment_icons', type: 'boolean', label: { en: 'Show payment badges', ar: 'إظهار شارات الدفع' }, defaultValue: false },
      {
        key: 'payment_methods',
        type: 'repeater',
        label: { en: 'Payment badges', ar: 'شارات الدفع' },
        fields: [
          { key: 'label', type: 'text', label: { en: 'Label (e.g. Visa, Mada)', ar: 'التسمية (مثل: Visa, مدى)' } },
        ],
      },
      { key: 'bg_color', type: 'color', label: { en: 'Background color', ar: 'لون الخلفية' } },
      { key: 'text_color', type: 'color', label: { en: 'Text color', ar: 'لون النص' } },
      { key: 'border_color', type: 'color', label: { en: 'Top border color', ar: 'لون الحد العلوي' } },
    ],
  },
  Component: CopyrightBar,
  defaultSettings: { alignment: 'between', show_payment_icons: false },
  defaultContent: { text: '© {year} {store}' },
};
