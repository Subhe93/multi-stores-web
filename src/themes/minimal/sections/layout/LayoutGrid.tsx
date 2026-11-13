import type { SectionDefinition, SectionRenderProps } from '../../../types';
import { ContainerShell } from './ContainerShell';
import { buildGridCss } from './containerCss';
import { ALIGN_OPTIONS } from './options';

function LayoutGrid(props: SectionRenderProps) {
  return <ContainerShell {...props} kind="grid" buildCss={buildGridCss} />;
}

export const layoutGridSection: SectionDefinition = {
  schema: {
    id: 'layout-grid',
    label: { en: 'Grid', ar: 'شبكة' },
    icon: 'grid',
    category: 'layout',
    description: {
      en: 'Arranges sections in a responsive grid with its own column count per device.',
      ar: 'يرتّب الأقسام في شبكة متجاوبة بعدد أعمدة خاص لكل جهاز.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: [],
    schema: [
      { key: 'columns_desktop', type: 'number', label: { en: 'Columns on desktop', ar: 'الأعمدة على الكمبيوتر' }, min: 1, max: 12, defaultValue: 2 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns on tablet', ar: 'الأعمدة على الجهاز اللوحي' }, min: 1, max: 12, defaultValue: 2 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns on mobile', ar: 'الأعمدة على الجوال' }, min: 1, max: 12, defaultValue: 1 },
      { key: 'gap_px', type: 'number', label: { en: 'Column gap (px)', ar: 'المسافة بين الأعمدة (px)' }, min: 0, max: 200, defaultValue: 24 },
      { key: 'row_gap_px', type: 'number', label: { en: 'Row gap (px)', ar: 'المسافة بين الصفوف (px)' }, min: 0, max: 200, defaultValue: 24 },
      {
        key: 'align',
        type: 'select',
        label: { en: 'Vertical alignment', ar: 'المحاذاة العمودية' },
        defaultValue: 'stretch',
        options: ALIGN_OPTIONS,
      },
    ],
  },
  Component: LayoutGrid,
  defaultSettings: { columns_desktop: 2, columns_tablet: 2, columns_mobile: 1, gap_px: 24, row_gap_px: 24, align: 'stretch' },
};
