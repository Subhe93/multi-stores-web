// Definition file — see HeroSlider.tsx for the RSC boundary rationale.
// Spotlight carousel variant of the static `testimonials` grid: one large
// quote at a time with crossfade, autoplay and direction-aware arrows.

import type { SectionDefinition } from '../../types';
import { TestimonialCarousel } from './TestimonialCarousel.client';

export const testimonialCarouselSection: SectionDefinition = {
  schema: {
    id: 'testimonial-carousel',
    label: { en: 'Testimonial Carousel', ar: 'سلايدر آراء العملاء' },
    icon: 'quote',
    category: 'social',
    description: {
      en: 'One spotlight quote at a time with crossfade, avatar, star rating, dots and arrows.',
      ar: 'اقتباس واحد بارز في كل مرة مع انتقال متلاشٍ وصورة وتقييم بالنجوم ونقاط وأسهم.',
    },
    translatable: ['heading', 'items'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      {
        key: 'autoplay_ms',
        type: 'number',
        label: { en: 'Autoplay interval (ms, 0 = off)', ar: 'تشغيل تلقائي (ms، 0 = إيقاف)' },
        min: 0,
        max: 30000,
        defaultValue: 6000,
      },
      { key: 'show_rating', type: 'boolean', label: { en: 'Show star rating', ar: 'إظهار التقييم بالنجوم' }, defaultValue: true },
      { key: 'show_arrows', type: 'boolean', label: { en: 'Show arrows', ar: 'إظهار الأسهم' }, defaultValue: true },
      {
        key: 'items',
        type: 'repeater',
        label: { en: 'Testimonials', ar: 'الآراء' },
        fields: [
          { key: 'quote', type: 'textarea', label: { en: 'Quote', ar: 'الاقتباس' } },
          { key: 'author', type: 'text', label: { en: 'Author name', ar: 'اسم صاحب الرأي' } },
          { key: 'role', type: 'text', label: { en: 'Role / company', ar: 'الصفة / الشركة' } },
          { key: 'avatar', type: 'image', label: { en: 'Avatar', ar: 'الصورة' } },
          { key: 'rating', type: 'number', label: { en: 'Rating (1–5)', ar: 'التقييم (1–5)' }, min: 1, max: 5, defaultValue: 5 },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'quote_color', type: 'color', label: { en: 'Quote text color', ar: 'لون نص الاقتباس' } },
      { key: 'quote_icon_color', type: 'color', label: { en: 'Quote icon color', ar: 'لون أيقونة الاقتباس' } },
      { key: 'author_color', type: 'color', label: { en: 'Author name color', ar: 'لون اسم الكاتب' } },
      { key: 'role_color', type: 'color', label: { en: 'Role / company color', ar: 'لون الصفة / الشركة' } },
      { key: 'star_color', type: 'color', label: { en: 'Star color', ar: 'لون النجوم' } },
      { key: 'star_empty_color', type: 'color', label: { en: 'Empty star color', ar: 'لون النجوم الفارغة' } },
    ],
  },
  Component: TestimonialCarousel,
  defaultSettings: { autoplay_ms: 6000, show_rating: true, show_arrows: true },
  defaultContent: {
    heading: 'Loved by our customers',
    items: [
      { quote: 'The attention to detail is remarkable — from the packaging to the product itself.', author: 'Sarah M.', role: 'Verified buyer', rating: 5 },
      { quote: 'Ordered twice already. The quality is consistently outstanding.', author: 'Ahmed K.', role: 'Verified buyer', rating: 5 },
      { quote: 'Beautiful craftsmanship and the customer service went above and beyond.', author: 'Lena P.', role: 'Verified buyer', rating: 5 },
    ],
  },
};
