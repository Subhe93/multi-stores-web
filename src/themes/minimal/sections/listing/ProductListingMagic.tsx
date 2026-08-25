// Definition file — see FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../../types';
import { ProductListingMagic } from './ProductListingMagic.client';

// Shared with the API seed (first ensure of CATALOG_TEMPLATE /
// COLLECTION_TEMPLATE) and mirrored in the dashboard section-schemas.
export const PRODUCT_LISTING_DEFAULT_SETTINGS: Record<string, unknown> = {
  show_hero: true,
  hero_height: 'auto',
  show_count: true,
  show_search: true,
  show_collections: true,
  show_sort: true,
  show_description: true,
  show_back_link: true,
  aspect: 'square',
  columns: 4,
  columns_tablet: 3,
  columns_mobile: 2,
};

export const productListingMagicSection: SectionDefinition = {
  schema: {
    id: 'product-listing',
    label: { en: 'Product Listing', ar: 'قائمة المنتجات' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: "The complete catalog body — banner, search, collections, sorting and the product grid. Renders the store's live products.",
      ar: 'جسم الكتالوج الكامل — البانر، البحث، التصنيفات، الفرز وشبكة المنتجات. يعرض منتجات المتجر الفعلية.',
    },
    pageTypes: ['CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE'],
    // Optional overrides — catalog only. A collection page always uses the
    // collection's own name/description.
    translatable: ['heading', 'subheading'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading override (catalog only)', ar: 'عنوان بديل (للكتالوج فقط)' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading (catalog only)', ar: 'عنوان فرعي (للكتالوج فقط)' } },
      { key: 'show_hero', type: 'boolean', label: { en: 'Show page banner', ar: 'إظهار بانر الصفحة' }, defaultValue: true },
      {
        key: 'hero_height',
        type: 'select',
        label: { en: 'Banner height', ar: 'ارتفاع البانر' },
        defaultValue: 'auto',
        options: [
          { value: 'auto', label: { en: 'Auto (store setting)', ar: 'تلقائي (إعداد المتجر)' } },
          { value: 'sm', label: { en: 'Small', ar: 'صغير' } },
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
        ],
      },
      { key: 'show_count', type: 'boolean', label: { en: 'Show product count', ar: 'إظهار عدد المنتجات' }, defaultValue: true },
      { key: 'show_search', type: 'boolean', label: { en: 'Show search box', ar: 'إظهار مربع البحث' }, defaultValue: true },
      {
        key: 'show_collections',
        type: 'boolean',
        label: { en: 'Show collection filters / sub-collections', ar: 'إظهار فلاتر التصنيفات / التصنيفات الفرعية' },
        defaultValue: true,
      },
      { key: 'show_sort', type: 'boolean', label: { en: 'Show sort options', ar: 'إظهار خيارات الفرز' }, defaultValue: true },
      {
        key: 'show_description',
        type: 'boolean',
        label: { en: 'Show collection description (collection page)', ar: 'إظهار وصف التصنيف (صفحة التصنيف)' },
        defaultValue: true,
      },
      {
        key: 'show_back_link',
        type: 'boolean',
        label: { en: 'Show "All collections" link (collection page)', ar: 'إظهار رابط "كل التصنيفات" (صفحة التصنيف)' },
        defaultValue: true,
      },
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
      { key: 'columns', type: 'number', label: { en: 'Columns — desktop', ar: 'الأعمدة — سطح المكتب' }, min: 1, max: 6, defaultValue: 4 },
      { key: 'columns_tablet', type: 'number', label: { en: 'Columns — tablet', ar: 'الأعمدة — تابلت' }, min: 1, max: 6, defaultValue: 3 },
      { key: 'columns_mobile', type: 'number', label: { en: 'Columns — mobile', ar: 'الأعمدة — جوال' }, min: 1, max: 4, defaultValue: 2 },
    ],
  },
  Component: ProductListingMagic,
  defaultSettings: PRODUCT_LISTING_DEFAULT_SETTINGS,
};
