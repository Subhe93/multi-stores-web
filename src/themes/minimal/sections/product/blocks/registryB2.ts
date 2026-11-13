// Definitions of the B2 product blocks of a PRODUCT_TEMPLATE (breadcrumb,
// short description, promotions, bundles, personalization, trust, shipping,
// tabs). Definition file only — see ../../FaqList.tsx for the RSC boundary
// rationale; the components are lazy client chunks (./lazyB2.tsx, ../lazy.tsx).
// Every block reads the page's shared product state, so all blocks show the
// same variant, price and choices as the monolith `product-page`.

import { TRUST_BADGE_ICON_OPTIONS } from '@/lib/trustBadgeIcons';
import type { SectionDefinition } from '../../../../types';
import { ProductTabsMagic } from '../lazy';
import {
  ProductBreadcrumbBlock,
  ProductBundlesBlock,
  ProductPersonalizationBlock,
  ProductPromotionsBlock,
  ProductShippingBlock,
  ProductShortDescriptionBlock,
  ProductTrustBlock,
} from './lazyB2';

const PRODUCT_ONLY: SectionDefinition['schema']['pageTypes'] = ['PRODUCT_TEMPLATE'];

export const productBreadcrumbSection: SectionDefinition = {
  schema: {
    id: 'product-breadcrumb',
    label: { en: 'Product breadcrumb', ar: 'مسار تنقل المنتج' },
    icon: 'chevrons-right',
    category: 'product',
    description: {
      en: 'Home › collection › product, from the product’s primary collection.',
      ar: 'الرئيسية › المجموعة › المنتج، حسب المجموعة الأساسية للمنتج.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: [],
    schema: [
      { key: 'show_current', type: 'boolean', label: { en: 'Show product name', ar: 'إظهار اسم المنتج' }, defaultValue: true },
    ],
  },
  Component: ProductBreadcrumbBlock,
  defaultSettings: { show_current: true },
};

export const productShortDescriptionSection: SectionDefinition = {
  schema: {
    id: 'product-short-description',
    label: { en: 'Short description', ar: 'الوصف المختصر' },
    icon: 'text',
    category: 'product',
    description: {
      en: 'The product’s short summary.',
      ar: 'الملخص القصير للمنتج.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: [],
    schema: [
      { key: 'show_divider', type: 'boolean', label: { en: 'Divider below', ar: 'خط فاصل أسفله' }, defaultValue: false },
    ],
  },
  Component: ProductShortDescriptionBlock,
  defaultSettings: {},
};

export const productPromotionsSection: SectionDefinition = {
  schema: {
    id: 'product-promotions',
    label: { en: 'Promotions', ar: 'العروض' },
    icon: 'tag',
    category: 'product',
    description: {
      en: 'Active promotions on the product: flash sale, buy X get Y, free shipping, discounts.',
      ar: 'العروض الفعّالة على المنتج: تخفيض سريع، اشترِ X واحصل على Y، شحن مجاني، خصومات.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: [],
    schema: [
      { key: 'show_end_date', type: 'boolean', label: { en: 'Show end date', ar: 'إظهار تاريخ الانتهاء' }, defaultValue: true },
    ],
  },
  Component: ProductPromotionsBlock,
  defaultSettings: { show_end_date: true },
};

export const productBundlesSection: SectionDefinition = {
  schema: {
    id: 'product-bundles',
    label: { en: 'Bundle offers', ar: 'عروض الباقات' },
    icon: 'layers',
    category: 'product',
    description: {
      en: 'Quantity-tier bundle offers. Picking one sets the quantity and the price.',
      ar: 'عروض الباقات حسب الكمية. اختيار عرض يضبط الكمية والسعر.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: [],
    schema: [],
  },
  Component: ProductBundlesBlock,
  defaultSettings: {},
};

export const productPersonalizationSection: SectionDefinition = {
  schema: {
    id: 'product-personalization',
    label: { en: 'Personalization', ar: 'التخصيص' },
    icon: 'edit',
    category: 'product',
    description: {
      en: 'Personalization fields, custom fields, customer upload and the designer form.',
      ar: 'حقول التخصيص، الحقول المخصّصة، رفع ملف العميل ونموذج المصمّم.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: [],
    schema: [
      {
        key: 'placement',
        type: 'select',
        label: { en: 'Show', ar: 'العرض' },
        description: {
          en: 'Split the form around the variants block: add one block set to "Before variants" above it and one set to "After variants" below it.',
          ar: 'قسّم النموذج حول قسم الخيارات: أضف قسماً بـ"قبل الخيارات" فوقه وقسماً بـ"بعد الخيارات" تحته.',
        },
        defaultValue: 'all',
        options: [
          { value: 'all', label: { en: 'Everything', ar: 'الكل' } },
          { value: 'before_variants', label: { en: 'Before variants (fields only)', ar: 'قبل الخيارات (الحقول فقط)' } },
          { value: 'after_variants', label: { en: 'After variants', ar: 'بعد الخيارات' } },
        ],
      },
      { key: 'show_heading', type: 'boolean', label: { en: 'Show heading', ar: 'إظهار العنوان' }, defaultValue: true },
      {
        key: 'button_style',
        type: 'select',
        label: { en: 'Designer button style', ar: 'نمط زر المصمّم' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مملوء' } },
          { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
        ],
      },
    ],
  },
  Component: ProductPersonalizationBlock,
  defaultSettings: { placement: 'all', show_heading: true, button_style: 'solid' },
};

export const productTrustSection: SectionDefinition = {
  schema: {
    id: 'product-trust',
    label: { en: 'Trust badges (product)', ar: 'شارات الثقة (المنتج)' },
    icon: 'shield',
    category: 'product',
    description: {
      en: 'Your own reassurance badges next to the product. Nothing is shown until you add badges.',
      ar: 'شارات الثقة الخاصة بك بجانب المنتج. لا يظهر شيء حتى تضيف شارات.',
    },
    pageTypes: PRODUCT_ONLY,
    // Per-locale content: the owner writes each claim themselves.
    translatable: ['trust_badges'],
    schema: [
      {
        key: 'trust_badges',
        type: 'repeater',
        label: { en: 'Trust badges', ar: 'شارات الثقة' },
        description: {
          en: 'Only state what is true for this store (e.g. shipping terms, returns, payment).',
          ar: 'اذكر فقط ما ينطبق فعلاً على متجرك (مثل شروط الشحن، الإرجاع، الدفع).',
        },
        fields: [
          { key: 'icon', type: 'select', label: { en: 'Icon', ar: 'الأيقونة' }, options: TRUST_BADGE_ICON_OPTIONS },
          { key: 'label', type: 'text', label: { en: 'Label', ar: 'التسمية' } },
          { key: 'description', type: 'text', label: { en: 'Description (optional)', ar: 'الوصف (اختياري)' } },
        ],
      },
      {
        key: 'columns',
        type: 'select',
        label: { en: 'Columns', ar: 'الأعمدة' },
        defaultValue: '2',
        options: [
          { value: '1', label: { en: 'One', ar: 'عمود واحد' } },
          { value: '2', label: { en: 'Two', ar: 'عمودان' } },
        ],
      },
    ],
  },
  Component: ProductTrustBlock,
  defaultSettings: { columns: '2' },
};

export const productShippingSection: SectionDefinition = {
  schema: {
    id: 'product-shipping',
    label: { en: 'Shipping info', ar: 'معلومات الشحن' },
    icon: 'truck',
    category: 'product',
    description: {
      en: 'Shipping zones and methods of the product: cost, delivery days, free-shipping threshold.',
      ar: 'مناطق وطرق شحن المنتج: التكلفة، أيام التوصيل، حد الشحن المجاني.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: [],
    schema: [
      { key: 'show_heading', type: 'boolean', label: { en: 'Show heading', ar: 'إظهار العنوان' }, defaultValue: true },
    ],
  },
  Component: ProductShippingBlock,
  defaultSettings: { show_heading: true },
};

// Existing key: setting names unchanged so saved templates keep working;
// `show_specifications` and its label are new.
export const productTabsSection: SectionDefinition = {
  schema: {
    id: 'product-tabs',
    label: { en: 'Product Tabs', ar: 'تبويبات المنتج' },
    icon: 'tabs',
    category: 'product',
    description: {
      en: 'Tabbed view of description, specifications, FAQs, shipping and returns.',
      ar: 'تبويبات للوصف، المواصفات، الأسئلة الشائعة، الشحن والإرجاع.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: [
      'tab_description_label',
      'tab_specifications_label',
      'tab_faqs_label',
      'tab_shipping_label',
      'tab_returns_label',
      'shipping_html',
      'returns_html',
    ],
    schema: [
      { key: 'show_description', type: 'boolean', label: { en: 'Show description tab', ar: 'تبويب الوصف' }, defaultValue: true },
      { key: 'show_specifications', type: 'boolean', label: { en: 'Show specifications tab', ar: 'تبويب المواصفات' }, defaultValue: true },
      { key: 'show_faqs', type: 'boolean', label: { en: 'Show FAQs tab', ar: 'تبويب الأسئلة الشائعة' }, defaultValue: true },
      { key: 'show_shipping', type: 'boolean', label: { en: 'Show shipping tab', ar: 'تبويب الشحن' }, defaultValue: false },
      { key: 'show_returns', type: 'boolean', label: { en: 'Show returns tab', ar: 'تبويب الإرجاع' }, defaultValue: false },
      { key: 'tab_description_label', type: 'text', label: { en: 'Description tab label', ar: 'عنوان تبويب الوصف' } },
      { key: 'tab_specifications_label', type: 'text', label: { en: 'Specifications tab label', ar: 'عنوان تبويب المواصفات' } },
      { key: 'tab_faqs_label', type: 'text', label: { en: 'FAQs tab label', ar: 'عنوان تبويب الأسئلة' } },
      { key: 'tab_shipping_label', type: 'text', label: { en: 'Shipping tab label', ar: 'عنوان تبويب الشحن' } },
      { key: 'tab_returns_label', type: 'text', label: { en: 'Returns tab label', ar: 'عنوان تبويب الإرجاع' } },
      { key: 'shipping_html', type: 'richtext', label: { en: 'Shipping content', ar: 'محتوى الشحن' } },
      { key: 'returns_html', type: 'richtext', label: { en: 'Returns content', ar: 'محتوى الإرجاع' } },
    ],
  },
  Component: ProductTabsMagic,
  defaultSettings: { show_description: true, show_specifications: true, show_faqs: true, show_shipping: false, show_returns: false },
};

/** B2 product blocks by section key; the Integrate step adds them to the theme registries. */
export const productBlocksB2: Record<string, SectionDefinition> = {
  'product-breadcrumb': productBreadcrumbSection,
  'product-short-description': productShortDescriptionSection,
  'product-promotions': productPromotionsSection,
  'product-bundles': productBundlesSection,
  'product-personalization': productPersonalizationSection,
  'product-trust': productTrustSection,
  'product-shipping': productShippingSection,
  'product-tabs': productTabsSection,
};
