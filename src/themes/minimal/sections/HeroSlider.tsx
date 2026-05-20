// Definition file — server-rendered SectionDefinition + schema. The
// interactive Slider lives in HeroSlider.client.tsx (RSC boundary).

import type { SectionDefinition } from '../../types';
import { HeroSlider } from './HeroSlider.client';

export const heroSliderSection: SectionDefinition = {
  schema: {
    id: 'hero-slider',
    label: { en: 'Hero Slider', ar: 'سلايدر البانر الرئيسي' },
    icon: 'images',
    category: 'showcase',
    description: {
      en: 'Multi-slide hero carousel with autoplay, arrows and dots. Full-bleed image background with text + CTA per slide.',
      ar: 'سلايدر بانر متعدد الشرائح مع تشغيل تلقائي وأسهم ونقاط. صورة كاملة العرض مع نص وزر لكل شريحة.',
    },
    translatable: ['slides'],
    schema: [
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'lg',
        options: [
          { value: 'sm', label: { en: 'Small (320px)', ar: 'صغير (320px)' } },
          { value: 'md', label: { en: 'Medium (480px)', ar: 'متوسط (480px)' } },
          { value: 'lg', label: { en: 'Large (640px)', ar: 'كبير (640px)' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      {
        key: 'overlay_opacity',
        type: 'number',
        label: { en: 'Overlay darkness (0–1)', ar: 'شفافية الطبقة (0-1)' },
        min: 0,
        max: 1,
        defaultValue: 0.4,
      },
      {
        key: 'autoplay_ms',
        type: 'number',
        label: { en: 'Autoplay interval (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' },
        min: 0,
        max: 30000,
        defaultValue: 5000,
      },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      { key: 'show_dots', type: 'boolean', label: { en: 'Show dots', ar: 'إظهار النقاط' }, defaultValue: true },
      { key: 'loop', type: 'boolean', label: { en: 'Loop slides', ar: 'تكرار الشرائح' }, defaultValue: true },
      {
        key: 'slides',
        type: 'repeater',
        label: { en: 'Slides', ar: 'الشرائح' },
        fields: [
          { key: 'image', type: 'image', label: { en: 'Background image', ar: 'صورة الخلفية' } },
          { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow', ar: 'تسمية صغيرة' }, maxLength: 40 },
          { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
          { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
          { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
          { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
          {
            key: 'alignment',
            type: 'select',
            label: { en: 'Text alignment', ar: 'محاذاة النص' },
            defaultValue: 'center',
            options: [
              { value: 'left', label: { en: 'Left', ar: 'يسار' } },
              { value: 'center', label: { en: 'Center', ar: 'وسط' } },
              { value: 'right', label: { en: 'Right', ar: 'يمين' } },
            ],
          },
        ],
      },
      // Section-level styling — applied to all slides for consistency.
      { key: 'eyebrow_color', type: 'color', label: { en: 'Eyebrow color', ar: 'لون التسمية الصغيرة' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background', ar: 'خلفية الزر' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color', ar: 'لون نص الزر' } },
      { key: 'cta_border_color', type: 'color', label: { en: 'Button border color', ar: 'لون حدود الزر' } },
      { key: 'cta_border_width', type: 'number', label: { en: 'Button border width (px)', ar: 'سماكة حدود الزر (px)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px)', ar: 'انحناء زوايا الزر (px)' }, min: 0, max: 100 },
    ],
  },
  Component: HeroSlider,
  defaultSettings: {
    height: 'lg',
    overlay_opacity: 0.4,
    autoplay_ms: 5000,
    show_arrows: true,
    show_dots: true,
    loop: true,
  },
  defaultContent: {
    slides: [
      {
        eyebrow: 'New season',
        heading: 'Welcome to our store',
        subheading: 'Discover the latest collection — handpicked just for you.',
        cta_text: 'Shop now',
        cta_url: '#',
        alignment: 'center',
      },
      {
        eyebrow: 'Limited time',
        heading: 'Spring sale up to 40% off',
        subheading: 'Save on best-sellers across every category.',
        cta_text: 'See offers',
        cta_url: '#',
        alignment: 'center',
      },
    ],
  },
};
