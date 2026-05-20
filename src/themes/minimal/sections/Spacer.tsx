import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr, numberOr } from '../../elementStyles';

function Spacer({ settings }: SectionRenderProps) {
  const height = Math.max(0, Math.min(400, numberOr(settings.height_px, 48)));
  const showDivider = settings.show_divider === true;
  const dividerStyle = (settings.divider_style as 'solid' | 'dashed' | 'dotted') || 'solid';

  // A pure layout spacer — height of empty space, with an optional centered
  // horizontal rule. No padding so the gap is exactly `height_px`.
  return (
    <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center' }}>
      {showDivider && (
        <hr
          className="w-full"
          style={{
            border: 'none',
            borderTop: `1px ${dividerStyle} ${colorOr(settings.divider_color, 'var(--theme-colors-border)')}`,
          }}
        />
      )}
    </div>
  );
}

export const spacerSection: SectionDefinition = {
  schema: {
    id: 'spacer',
    label: { en: 'Spacer / Divider', ar: 'فاصل / مسافة' },
    icon: 'minus',
    category: 'layout',
    description: {
      en: 'Adds vertical breathing room between sections, with an optional divider line.',
      ar: 'يضيف مسافة عمودية بين السكشنات، مع خط فاصل اختياري.',
    },
    translatable: [],
    schema: [
      { key: 'height_px', type: 'number', label: { en: 'Height (px)', ar: 'الارتفاع (px)' }, min: 0, max: 400, defaultValue: 48 },
      { key: 'show_divider', type: 'boolean', label: { en: 'Show divider line', ar: 'إظهار خط فاصل' }, defaultValue: false },
      {
        key: 'divider_style',
        type: 'select',
        label: { en: 'Divider style', ar: 'نمط الخط' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'متصل' } },
          { value: 'dashed', label: { en: 'Dashed', ar: 'متقطّع' } },
          { value: 'dotted', label: { en: 'Dotted', ar: 'منقّط' } },
        ],
      },
      { key: 'divider_color', type: 'color', label: { en: 'Divider color', ar: 'لون الخط' } },
    ],
  },
  Component: Spacer,
  defaultSettings: { height_px: 48, show_divider: false, divider_style: 'solid' },
};
