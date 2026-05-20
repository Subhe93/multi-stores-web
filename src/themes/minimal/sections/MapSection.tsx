// Definition file — see FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { MapSection } from './MapSection.client';

export const mapSection: SectionDefinition = {
  schema: {
    id: 'map',
    label: { en: 'Map', ar: 'الخريطة' },
    icon: 'map-pin',
    category: 'content',
    description: {
      en: 'A modern store locator: one or more branches with a switcher, styled Google map, info card (address, phone, hours) and one-tap directions.',
      ar: 'محدّد مواقع عصري: فرع أو أكثر مع مبدّل، خريطة Google منسّقة، بطاقة معلومات (العنوان، الهاتف، الساعات) واتجاهات بنقرة.',
    },
    translatable: ['heading', 'subheading', 'locations'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      {
        key: 'layout',
        type: 'select',
        label: { en: 'Layout', ar: 'التخطيط' },
        defaultValue: 'split-right',
        options: [
          { value: 'split-right', label: { en: 'Info + map (map right)', ar: 'معلومات + خريطة (يمين)' } },
          { value: 'split-left', label: { en: 'Info + map (map left)', ar: 'معلومات + خريطة (يسار)' } },
          { value: 'overlay', label: { en: 'Map with floating card', ar: 'خريطة مع بطاقة عائمة' } },
          { value: 'full', label: { en: 'Full-width map', ar: 'خريطة بعرض كامل' } },
        ],
      },
      {
        key: 'map_style',
        type: 'select',
        label: { en: 'Map style', ar: 'نمط الخريطة' },
        defaultValue: 'standard',
        options: [
          { value: 'standard', label: { en: 'Standard', ar: 'قياسي' } },
          { value: 'grayscale', label: { en: 'Grayscale', ar: 'رمادي' } },
          { value: 'muted', label: { en: 'Muted', ar: 'هادئ' } },
          { value: 'dark', label: { en: 'Dark', ar: 'داكن' } },
        ],
      },
      {
        key: 'card_style',
        type: 'select',
        label: { en: 'Info card style', ar: 'نمط بطاقة المعلومات' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مصمت' } },
          { value: 'glass', label: { en: 'Glass (blur)', ar: 'زجاجي (ضبابي)' } },
        ],
      },
      { key: 'zoom', type: 'number', label: { en: 'Zoom level', ar: 'مستوى التقريب' }, min: 1, max: 20, defaultValue: 14 },
      { key: 'height', type: 'number', label: { en: 'Map height (px)', ar: 'ارتفاع الخريطة (px)' }, min: 220, max: 900, defaultValue: 440 },
      { key: 'rounded', type: 'boolean', label: { en: 'Rounded corners', ar: 'حواف دائرية' }, defaultValue: true },
      { key: 'show_directions', type: 'boolean', label: { en: 'Show "Get directions" button', ar: 'إظهار زر الاتجاهات' }, defaultValue: true },
      {
        key: 'locations',
        type: 'repeater',
        label: { en: 'Locations', ar: 'المواقع' },
        fields: [
          { key: 'name', type: 'text', label: { en: 'Branch name', ar: 'اسم الفرع' } },
          { key: 'address', type: 'textarea', label: { en: 'Address (used for the map)', ar: 'العنوان (يُستخدم للخريطة)' } },
          { key: 'lat', type: 'text', label: { en: 'Latitude (optional, precise pin)', ar: 'خط العرض (اختياري، تحديد دقيق)' } },
          { key: 'lng', type: 'text', label: { en: 'Longitude (optional)', ar: 'خط الطول (اختياري)' } },
          { key: 'phone', type: 'text', label: { en: 'Phone', ar: 'الهاتف' } },
          { key: 'email', type: 'text', label: { en: 'Email', ar: 'البريد الإلكتروني' } },
          { key: 'hours', type: 'textarea', label: { en: 'Opening hours (one per line)', ar: 'ساعات العمل (سطر لكل يوم)' } },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
    ],
  },
  Component: MapSection,
  defaultSettings: {
    layout: 'split-right',
    map_style: 'standard',
    card_style: 'solid',
    zoom: 14,
    height: 440,
    rounded: true,
    show_directions: true,
  },
  defaultContent: {
    heading: 'Visit us',
    locations: [
      {
        name: 'Flagship Store',
        address: '350 5th Ave, New York, NY 10118',
        phone: '+1 (212) 555-0100',
        hours: 'Mon–Fri: 9:00 – 20:00\nSat–Sun: 10:00 – 18:00',
      },
    ],
  },
};
