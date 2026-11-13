import type { SectionDefinition, SectionRenderProps } from '../../../types';
import { ContainerShell } from './ContainerShell';
import { buildColumnCss } from './containerCss';
import { ALIGN_OPTIONS } from './options';

function LayoutColumn(props: SectionRenderProps) {
  return <ContainerShell {...props} kind="column" buildCss={buildColumnCss} />;
}

export const layoutColumnSection: SectionDefinition = {
  schema: {
    id: 'layout-column',
    label: { en: 'Column', ar: 'عمود' },
    icon: 'rows',
    category: 'layout',
    description: {
      en: 'Stacks sections on top of each other. Can stay in view while scrolling on desktop.',
      ar: 'يضع الأقسام فوق بعضها، ويمكن تثبيته أثناء التمرير على الكمبيوتر.',
    },
    pageTypes: ['PRODUCT_TEMPLATE'],
    translatable: [],
    schema: [
      { key: 'gap_px', type: 'number', label: { en: 'Gap (px)', ar: 'المسافة بين الأقسام (px)' }, min: 0, max: 200, defaultValue: 16 },
      {
        key: 'align',
        type: 'select',
        label: { en: 'Horizontal alignment', ar: 'المحاذاة الأفقية' },
        defaultValue: 'stretch',
        options: ALIGN_OPTIONS,
      },
      {
        key: 'sticky_desktop',
        type: 'boolean',
        label: { en: 'Sticky on desktop', ar: 'تثبيت أثناء التمرير على الكمبيوتر' },
        description: {
          en: 'Keeps the column in view while the next column scrolls.',
          ar: 'يبقى العمود ظاهراً بينما يتحرك العمود المجاور مع التمرير.',
        },
        defaultValue: false,
      },
      { key: 'sticky_top_px', type: 'number', label: { en: 'Sticky top offset (px)', ar: 'المسافة من الأعلى عند التثبيت (px)' }, min: 0, max: 400, defaultValue: 24 },
    ],
  },
  Component: LayoutColumn,
  defaultSettings: { gap_px: 16, align: 'stretch', sticky_desktop: false, sticky_top_px: 24 },
};
