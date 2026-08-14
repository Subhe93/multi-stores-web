// Definition file — see HeroSlider.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { HeroVideo } from './HeroVideo.client';

export const heroVideoSection: SectionDefinition = {
  schema: {
    id: 'hero-video',
    label: { en: 'Hero Video', ar: 'بانر فيديو' },
    icon: 'video',
    category: 'showcase',
    description: {
      en: 'Fullscreen-feel hero with a silent looping background video, dark overlay and headline. Falls back to the poster image when the video is missing or fails.',
      ar: 'بانر بإحساس ملء الشاشة مع فيديو خلفية صامت متكرر وطبقة داكنة وعنوان. يعود لصورة الغلاف عند غياب الفيديو أو فشله.',
    },
    translatable: ['eyebrow', 'heading', 'subheading', 'cta_text', 'cta_url'],
    schema: [
      { key: 'video_url', type: 'url', label: { en: 'Video URL (mp4 / webm)', ar: 'رابط الفيديو (mp4 / webm)' } },
      { key: 'poster_image', type: 'image', label: { en: 'Poster image (fallback)', ar: 'صورة الغلاف (بديلة)' } },
      { key: 'overlay_opacity', type: 'number', label: { en: 'Overlay darkness (0–1)', ar: 'شفافية الطبقة (0-1)' }, min: 0, max: 1, defaultValue: 0.35 },
      {
        key: 'height',
        type: 'select',
        label: { en: 'Height', ar: 'الارتفاع' },
        defaultValue: 'lg',
        options: [
          { value: 'md', label: { en: 'Medium', ar: 'متوسط' } },
          { value: 'lg', label: { en: 'Large', ar: 'كبير' } },
          { value: 'full', label: { en: 'Full screen', ar: 'شاشة كاملة' } },
        ],
      },
      {
        key: 'alignment',
        type: 'select',
        label: { en: 'Alignment', ar: 'المحاذاة' },
        defaultValue: 'center',
        options: [
          { value: 'left', label: { en: 'Left', ar: 'يسار' } },
          { value: 'center', label: { en: 'Center', ar: 'وسط' } },
          { value: 'right', label: { en: 'Right', ar: 'يمين' } },
        ],
      },
      { key: 'eyebrow', type: 'text', label: { en: 'Eyebrow (small label)', ar: 'تسمية صغيرة فوق العنوان' }, maxLength: 40 },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' }, maxLength: 120 },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' }, maxLength: 280 },
      { key: 'cta_text', type: 'text', label: { en: 'Button text', ar: 'نص الزر' }, maxLength: 40 },
      { key: 'cta_url', type: 'url', label: { en: 'Button URL', ar: 'رابط الزر' } },
      // Per-element styling — every override is optional.
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
  Component: HeroVideo,
  defaultSettings: { height: 'lg', alignment: 'center', overlay_opacity: 0.35 },
  defaultContent: {
    eyebrow: 'New season',
    heading: 'See it in motion',
    subheading: 'A cinematic backdrop that brings your story to life.',
    cta_text: 'Shop now',
  },
};
