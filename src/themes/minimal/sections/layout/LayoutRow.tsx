import type { SectionDefinition, SectionRenderProps } from '../../../types';
import { ContainerShell } from './ContainerShell';
import { buildRowCss } from './containerCss';
import { ALIGN_OPTIONS } from './options';

function LayoutRow(props: SectionRenderProps) {
  return <ContainerShell {...props} kind="row" buildCss={buildRowCss} />;
}

export const layoutRowSection: SectionDefinition = {
  schema: {
    id: 'layout-row',
    label: { en: 'Row', ar: 'صف' },
    icon: 'columns',
    category: 'layout',
    description: {
      en: 'Places sections side by side in columns. Stacks on smaller screens.',
      ar: 'يضع الأقسام جنباً إلى جنب في أعمدة، وتتكدّس على الشاشات الأصغر.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: [],
    schema: [
      { key: 'gap_px', type: 'number', label: { en: 'Gap (px)', ar: 'المسافة بين الأعمدة (px)' }, min: 0, max: 200, defaultValue: 32 },
      {
        key: 'align',
        type: 'select',
        label: { en: 'Vertical alignment', ar: 'المحاذاة العمودية' },
        defaultValue: 'stretch',
        options: ALIGN_OPTIONS,
      },
      {
        key: 'child_width',
        type: 'select',
        label: { en: 'Column width', ar: 'عرض الأعمدة' },
        defaultValue: 'fill',
        options: [
          { value: 'fill', label: { en: 'Fill the row (by ratio)', ar: 'ملء الصف (حسب النسبة)' } },
          { value: 'auto', label: { en: 'Fit the content', ar: 'بحسب المحتوى' } },
        ],
      },
      {
        key: 'justify',
        type: 'select',
        label: { en: 'Horizontal alignment', ar: 'المحاذاة الأفقية' },
        description: {
          en: 'Applies when columns fit their content.',
          ar: 'تُطبَّق عندما يكون عرض الأعمدة بحسب المحتوى.',
        },
        defaultValue: 'start',
        options: [
          { value: 'start', label: { en: 'Start', ar: 'البداية' } },
          { value: 'center', label: { en: 'Center', ar: 'الوسط' } },
          { value: 'end', label: { en: 'End', ar: 'النهاية' } },
          { value: 'between', label: { en: 'Space between', ar: 'توزيع بالتساوي' } },
        ],
      },
      { key: 'wrap', type: 'boolean', label: { en: 'Wrap to new lines', ar: 'الالتفاف إلى سطر جديد' }, defaultValue: false },
      {
        key: 'stack_on',
        type: 'select',
        label: { en: 'Stack columns on', ar: 'تكديس الأعمدة على' },
        defaultValue: 'tablet',
        options: [
          { value: 'tablet', label: { en: 'Tablet and mobile', ar: 'الجهاز اللوحي والجوال' } },
          { value: 'mobile', label: { en: 'Mobile only', ar: 'الجوال فقط' } },
          { value: 'never', label: { en: 'Never', ar: 'أبداً' } },
        ],
      },
      { key: 'reverse_on_mobile', type: 'boolean', label: { en: 'Reverse order on mobile', ar: 'عكس الترتيب على الجوال' }, defaultValue: false },
    ],
  },
  Component: LayoutRow,
  defaultSettings: {
    gap_px: 32,
    align: 'stretch',
    child_width: 'fill',
    justify: 'start',
    wrap: false,
    stack_on: 'tablet',
    reverse_on_mobile: false,
  },
};
