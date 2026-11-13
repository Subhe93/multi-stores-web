// Definitions of the B1 product blocks of a PRODUCT_TEMPLATE (title, price,
// variant picker, quantity + add to cart) plus the rebuilt split sections
// that keep their keys (product-gallery, product-details, add-to-cart).
// Definition file only — see ../../FaqList.tsx for the RSC boundary
// rationale; the components are lazy client chunks (./lazyB1.tsx, ../lazy.tsx).
// Every block reads the page's shared product state, so they all follow the
// same variant, price, quantity and gallery as the monolith `product-page`.

import type { SectionDefinition } from '../../../../types';
import { productGalleryMagicSection } from '../ProductGalleryMagic';
import { productDetailsMagicSection } from '../ProductDetailsMagic';
import { addToCartMagicSection } from '../AddToCartMagic';
import { ProductBuyBlock, ProductPriceBlock, ProductTitleBlock, ProductVariantsBlock } from './lazyB1';

const PRODUCT_ONLY: SectionDefinition['schema']['pageTypes'] = ['PRODUCT_TEMPLATE'];

export const productTitleSection: SectionDefinition = {
  schema: {
    id: 'product-title',
    label: { en: 'Product title', ar: 'عنوان المنتج' },
    icon: 'type',
    category: 'product',
    description: {
      en: 'The product name (H1), with its primary collection above and the seller below.',
      ar: 'اسم المنتج (H1)، مع مجموعته الأساسية فوقه والبائع تحته.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: [],
    schema: [
      { key: 'show_collection', type: 'boolean', label: { en: 'Show primary collection', ar: 'إظهار المجموعة الأساسية' }, defaultValue: true },
      { key: 'show_vendor', type: 'boolean', label: { en: 'Show seller', ar: 'إظهار البائع' }, defaultValue: true },
    ],
  },
  Component: ProductTitleBlock,
  defaultSettings: { show_collection: true, show_vendor: true },
};

export const productPriceSection: SectionDefinition = {
  schema: {
    id: 'product-price',
    label: { en: 'Product price', ar: 'سعر المنتج' },
    icon: 'tag',
    category: 'product',
    description: {
      en: 'Price of the chosen variant × quantity, with compare-at price, savings and tax note. Follows bundles and personalization.',
      ar: 'سعر الخيار المختار × الكمية، مع السعر قبل الخصم والتوفير وملاحظة الضريبة. يتبع العروض والتخصيص.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: [],
    schema: [
      { key: 'show_compare_at', type: 'boolean', label: { en: 'Show compare-at price', ar: 'إظهار السعر قبل الخصم' }, defaultValue: true },
      { key: 'show_savings', type: 'boolean', label: { en: 'Show savings', ar: 'إظهار مبلغ التوفير' }, defaultValue: true },
      { key: 'show_unit_price', type: 'boolean', label: { en: 'Show unit price × quantity', ar: 'إظهار سعر القطعة × الكمية' }, defaultValue: true },
      { key: 'show_sku', type: 'boolean', label: { en: 'Show SKU', ar: 'إظهار رمز المنتج (SKU)' }, defaultValue: true },
    ],
  },
  Component: ProductPriceBlock,
  defaultSettings: { show_compare_at: true, show_savings: true, show_unit_price: true, show_sku: true },
};

export const productVariantsSection: SectionDefinition = {
  schema: {
    id: 'product-variants',
    label: { en: 'Variant picker', ar: 'اختيار الخيارات' },
    icon: 'palette',
    category: 'product',
    description: {
      en: 'Colour swatches, size pills and option cards. The gallery and price follow the choice.',
      ar: 'دوائر الألوان وأزرار المقاسات وبطاقات الخيارات. المعرض والسعر يتبعان الاختيار.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: [],
    schema: [],
  },
  Component: ProductVariantsBlock,
  defaultSettings: {},
};

export const productBuySection: SectionDefinition = {
  schema: {
    id: 'product-buy',
    label: { en: 'Quantity + add to cart', ar: 'الكمية + إضافة للسلة' },
    icon: 'shopping-cart',
    category: 'product',
    description: {
      en: 'Quantity picker (stock and bundle aware) and the add-to-cart button, with an optional sticky button on mobile.',
      ar: 'اختيار الكمية (حسب المخزون والعروض) وزر الإضافة للسلة، مع زر ثابت اختياري أسفل الجوال.',
    },
    pageTypes: PRODUCT_ONLY,
    translatable: ['button_label'],
    schema: [
      {
        key: 'button_style',
        type: 'select',
        label: { en: 'Button style', ar: 'نمط الزر' },
        defaultValue: 'solid',
        options: [
          { value: 'solid', label: { en: 'Solid', ar: 'مملوء' } },
          { value: 'outline', label: { en: 'Outline', ar: 'إطار' } },
        ],
      },
      { key: 'show_quantity', type: 'boolean', label: { en: 'Show quantity picker', ar: 'إظهار اختيار الكمية' }, defaultValue: true },
      { key: 'sticky_on_mobile', type: 'boolean', label: { en: 'Sticky button on mobile', ar: 'زر ثابت أسفل الجوال' }, defaultValue: false },
      { key: 'button_label', type: 'text', label: { en: 'Button label', ar: 'نص الزر' } },
    ],
  },
  Component: ProductBuyBlock,
  defaultSettings: { button_style: 'solid', show_quantity: true, sticky_on_mobile: false },
};

/** Every B1 definition by section key (new blocks + rebuilt split sections). */
export const registryB1: Record<string, SectionDefinition> = {
  'product-title': productTitleSection,
  'product-price': productPriceSection,
  'product-variants': productVariantsSection,
  'product-buy': productBuySection,
  'product-gallery': productGalleryMagicSection,
  'product-details': productDetailsMagicSection,
  'add-to-cart': addToCartMagicSection,
};

/** Same map under the B2 naming (`productBlocksB2`). */
export const productBlocksB1 = registryB1;
