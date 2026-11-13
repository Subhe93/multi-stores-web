import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Clarity recordings must never show customer names or personal data
// (plans/clarity/PLAN.md section 9, items 9 and 12). These surfaces carry
// `data-clarity-mask="True"`; a refactor that drops one fails here.

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const MASKED = [
  'app/store/[storeSlug]/account/layout.tsx',
  'app/store/[storeSlug]/auth/layout.tsx',
  'app/store/[storeSlug]/(checkout)/layout.tsx',
  'app/store/[storeSlug]/cart/page.tsx',
  'components/product/personalization/PersonalizationForm.tsx',
  'components/product/CustomFieldsForm.tsx',
  'components/cart/CartItem.tsx',
  'components/cart/CartDrawer.tsx',
  'components/cart/PersonalizationSummary.tsx',
  'components/account/OrderFieldValues.tsx',
  'components/designer/DesignerInline.tsx',
];

describe('Clarity masking attributes', () => {
  it.each(MASKED)('%s masks its content', (file) => {
    const source = readFileSync(join(SRC, file), 'utf8');
    expect(source).toContain('data-clarity-mask="True"');
  });

  it('auth layout masks both of its wrappers (with and without a background)', () => {
    const source = readFileSync(join(SRC, 'app/store/[storeSlug]/auth/layout.tsx'), 'utf8');
    expect(source.match(/data-clarity-mask="True"/g)).toHaveLength(2);
  });

  it('designer masks both its preview (customer photos) and its form', () => {
    const source = readFileSync(join(SRC, 'components/designer/DesignerInline.tsx'), 'utf8');
    expect(source.match(/data-clarity-mask="True"/g)).toHaveLength(2);
  });

  it('cart page masks the line rows and the summary mini list', () => {
    const source = readFileSync(join(SRC, 'app/store/[storeSlug]/cart/page.tsx'), 'utf8');
    expect(source.match(/data-clarity-mask="True"/g)).toHaveLength(2);
  });
});
