// Definition file — see HeroSlider.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { ProductSlider } from './ProductSlider.client';

export const productSliderSection: SectionDefinition = {
  schema: {
    id: 'product-slider',
    label: { en: 'Product Slider', ar: 'سلايدر المنتجات' },
    icon: 'package',
    category: 'commerce',
    description: {
      en: 'Auto-loaded products in a horizontal carousel. Independent slides-per-view per breakpoint, optional autoplay.',
      ar: 'منتجات يتم جلبها تلقائياً ضمن سلايدر أفقي. عدد شرائح مستقل لكل جهاز وتشغيل تلقائي اختياري.',
    },
    translatable: ['heading', 'subheading', 'link_label'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'filter',
        type: 'select',
        label: { en: 'Pick from', ar: 'اختر من' },
        defaultValue: 'newest',
        options: [
          { value: 'newest', label: { en: 'Newest', ar: 'الأحدث' } },
          { value: 'featured', label: { en: 'Featured only', ar: 'المميّزة فقط' } },
        ],
      },
      { key: 'limit', type: 'number', label: { en: 'Number of products', ar: 'عدد المنتجات' }, min: 1, max: 24, defaultValue: 8 },
      {
        key: 'slides_per_view',
        type: 'number',
        label: { en: 'Slides per view — desktop', ar: 'عدد الشرائح — سطح المكتب' },
        min: 1,
        max: 6,
        defaultValue: 4,
      },
      {
        key: 'slides_per_view_tablet',
        type: 'number',
        label: { en: 'Slides per view — tablet', ar: 'عدد الشرائح — تابلت' },
        min: 1,
        max: 6,
        defaultValue: 3,
      },
      {
        key: 'slides_per_view_mobile',
        type: 'number',
        label: { en: 'Slides per view — mobile', ar: 'عدد الشرائح — جوال' },
        min: 1,
        max: 4,
        defaultValue: 1.5,
      },
      { key: 'gap_px', type: 'number', label: { en: 'Gap between slides (px)', ar: 'الفجوة بين الشرائح (px)' }, min: 0, max: 64, defaultValue: 16 },
      {
        key: 'autoplay_ms',
        type: 'number',
        label: { en: 'Autoplay interval (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' },
        min: 0,
        max: 30000,
        defaultValue: 0,
      },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      { key: 'show_dots', type: 'boolean', label: { en: 'Show dots', ar: 'إظهار النقاط' }, defaultValue: false },
      { key: 'loop', type: 'boolean', label: { en: 'Loop slides', ar: 'تكرار الشرائح' }, defaultValue: false },
      { key: 'link_label', type: 'text', label: { en: 'See all link text', ar: 'نص رابط الكل' } },
      { key: 'link_url', type: 'url', label: { en: 'See all link URL', ar: 'رابط الكل' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'link_color', type: 'color', label: { en: 'See-all link color', ar: 'لون رابط الكل' } },
    ],
  },
  Component: ProductSlider,
  defaultSettings: {
    filter: 'newest',
    limit: 8,
    slides_per_view: 4,
    slides_per_view_tablet: 3,
    slides_per_view_mobile: 1.5,
    gap_px: 16,
    autoplay_ms: 0,
    show_arrows: true,
    show_dots: false,
    loop: false,
  },
  defaultContent: { heading: 'Featured products' },
};
