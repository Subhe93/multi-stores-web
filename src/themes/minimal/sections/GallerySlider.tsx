// Definition file — see HeroSlider.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { GallerySlider } from './GallerySlider.client';

export const gallerySliderSection: SectionDefinition = {
  schema: {
    id: 'gallery-slider',
    label: { en: 'Gallery Slider', ar: 'سلايدر معرض الصور' },
    icon: 'gallery',
    category: 'showcase',
    description: {
      en: 'Horizontal image carousel. Independent slides-per-view per breakpoint, optional autoplay, captions on hover.',
      ar: 'شريط صور أفقي. عدد شرائح مستقل لكل جهاز، تشغيل تلقائي اختياري، تسميات عند المرور.',
    },
    translatable: ['heading', 'subheading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'slides_per_view',
        type: 'number',
        label: { en: 'Slides per view — desktop', ar: 'عدد الشرائح — سطح المكتب' },
        min: 1,
        max: 6,
        defaultValue: 3,
      },
      {
        key: 'slides_per_view_tablet',
        type: 'number',
        label: { en: 'Slides per view — tablet', ar: 'عدد الشرائح — تابلت' },
        min: 1,
        max: 6,
        defaultValue: 2,
      },
      {
        key: 'slides_per_view_mobile',
        type: 'number',
        label: { en: 'Slides per view — mobile', ar: 'عدد الشرائح — جوال' },
        min: 1,
        max: 4,
        defaultValue: 1,
      },
      { key: 'gap_px', type: 'number', label: { en: 'Gap between slides (px)', ar: 'الفجوة بين الشرائح (px)' }, min: 0, max: 64, defaultValue: 16 },
      {
        key: 'aspect',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: 'square',
        options: [
          { value: 'square', label: { en: 'Square', ar: 'مربع' } },
          { value: 'portrait', label: { en: 'Portrait', ar: 'طولي' } },
          { value: 'landscape', label: { en: 'Landscape', ar: 'عرضي' } },
          { value: 'wide', label: { en: 'Wide 16:9', ar: 'عريض 16:9' } },
        ],
      },
      { key: 'show_caption', type: 'boolean', label: { en: 'Show captions on hover', ar: 'إظهار التسميات عند المرور' }, defaultValue: true },
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true },
      {
        key: 'autoplay_ms',
        type: 'number',
        label: { en: 'Autoplay interval (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' },
        min: 0,
        max: 30000,
        defaultValue: 0,
      },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      { key: 'show_dots', type: 'boolean', label: { en: 'Show dots', ar: 'إظهار النقاط' }, defaultValue: true },
      { key: 'loop', type: 'boolean', label: { en: 'Loop slides', ar: 'تكرار الشرائح' }, defaultValue: false },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Images', ar: 'الصور' },
        fields: [
          { key: 'url', type: 'image', label: { en: 'Image', ar: 'الصورة' } },
          { key: 'alt', type: 'text', label: { en: 'Alt text', ar: 'نص بديل' } },
          { key: 'caption', type: 'text', label: { en: 'Caption', ar: 'تسمية توضيحية' } },
          { key: 'href', type: 'url', label: { en: 'Link (optional)', ar: 'رابط (اختياري)' } },
        ],
      },
    ],
  },
  Component: GallerySlider,
  defaultSettings: {
    slides_per_view: 3,
    slides_per_view_tablet: 2,
    slides_per_view_mobile: 1,
    gap_px: 16,
    aspect: 'square',
    show_caption: true,
    rounded: true,
    autoplay_ms: 0,
    show_arrows: true,
    show_dots: true,
    loop: false,
  },
  defaultContent: { items: [] },
};
