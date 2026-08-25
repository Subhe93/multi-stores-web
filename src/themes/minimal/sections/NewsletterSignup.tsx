// Definition file — see FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { NewsletterSignup } from './NewsletterSignup.client';

export const newsletterSignupSection: SectionDefinition = {
  schema: {
    id: 'newsletter-signup',
    label: { en: 'Newsletter Signup', ar: 'الاشتراك بالنشرة' },
    icon: 'mail',
    category: 'social',
    description: {
      en: 'Email capture form. Three styles: surface card, plain inline, or gradient banner.',
      ar: 'نموذج لجمع البريد الإلكتروني. ثلاثة أنماط: بطاقة، سطر، أو بانر متدرّج.',
    },
    // Email capture often lives in the footer (above the copyright bar).
    // Header placement is rare and would crowd nav, so HEADER is excluded.
    pageTypes: ['HOME', 'STATIC', 'LANDING', 'PRODUCT_TEMPLATE', 'CATALOG_TEMPLATE', 'COLLECTION_TEMPLATE', 'FOOTER'],
    translatable: ['heading', 'subheading', 'placeholder', 'button_label', 'success_message'],
    schema: [
      {
        key: 'style',
        type: 'select',
        label: { en: 'Style', ar: 'النمط' },
        defaultValue: 'card',
        options: [
          { value: 'card', label: { en: 'Card', ar: 'بطاقة' } },
          { value: 'inline', label: { en: 'Inline', ar: 'سطر' } },
          { value: 'banner', label: { en: 'Banner', ar: 'بانر' } },
        ],
      },
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'placeholder', type: 'text', label: { en: 'Input placeholder', ar: 'النص داخل الحقل' } },
      { key: 'button_label', type: 'text', label: { en: 'Button label', ar: 'نص الزر' } },
      { key: 'success_message', type: 'text', label: { en: 'Success message', ar: 'رسالة النجاح' } },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'cta_bg_color', type: 'color', label: { en: 'Button background', ar: 'خلفية الزر' } },
      { key: 'cta_text_color', type: 'color', label: { en: 'Button text color', ar: 'لون نص الزر' } },
      { key: 'cta_border_color', type: 'color', label: { en: 'Button border color', ar: 'لون حدود الزر' } },
      { key: 'cta_border_width', type: 'number', label: { en: 'Button border width (px)', ar: 'سماكة حدود الزر (px)' }, min: 0, max: 8, defaultValue: 0 },
      { key: 'cta_border_radius', type: 'number', label: { en: 'Button corner radius (px)', ar: 'انحناء زوايا الزر (px)' }, min: 0, max: 100 },
    ],
  },
  Component: NewsletterSignup,
  defaultSettings: { style: 'card' },
};
