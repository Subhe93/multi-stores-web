// Definition file — see FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { CollectionProducts } from './CollectionProducts.client';

export const collectionProductsSection: SectionDefinition = {
  schema: {
    id: 'collection-products',
    label: { en: 'Products by Category', ar: 'منتجات حسب الفئة' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'A grid of products pulled from one category. Independent column counts per breakpoint.',
      ar: 'شبكة منتجات تُجلب من فئة واحدة. عدد أعمدة مستقل لكل جهاز.',
    },
    translatable: ['heading', 'subheading', 'link_label'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'category', type: 'collectionPicker', label: { en: 'Category', ar: 'الفئة' }, description: { en: 'Pick one of your categories — its products fill the grid.', ar: 'اختر إحدى فئاتك — تُعرض منتجاتها في الشبكة.' } },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Image aspect ratio', ar: 'نسبة أبعاد الصور' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square (1:1)', ar: 'مربّع (1:1)' } },
          { value: 'portrait', label: { en: 'Portrait (4:5)', ar: 'طولي (4:5)' } },
          { value: 'landscape', label: { en: 'Landscape (4:3)', ar: 'عرضي (4:3)' } },
        ],
      },
      { key: 'limit', type: 'number', label: { en: 'Number of products', ar: 'عدد المنتجات' }, min: 1, max: 24, defaultValue: 8 },
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop', ar: 'الأعمدة — سطح المكتب' }, min: 1, max: 6, defaultValue: 4 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 2 },
      { key: 'link_label', type: 'text', label: { en: 'See all link text', ar: 'نص رابط الكل' } },
      { key: 'link_url', type: 'url', label: { en: 'See all link URL', ar: 'رابط الكل' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'link_color', type: 'color', label: { en: 'See-all link color', ar: 'لون رابط الكل' } },
    ],
  },
  Component: CollectionProducts,
  defaultSettings: { aspect: 'square', limit: 8, columns: 4, columns_tablet: 3, columns_mobile: 2 },
  defaultContent: { heading: 'Shop the collection' },
};
