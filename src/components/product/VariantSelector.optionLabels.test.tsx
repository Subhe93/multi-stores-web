import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VariantSelector } from './VariantSelector';
import { OrderReceipt, type OrderReceiptOrder } from '@/components/checkout/OrderReceipt';

// M159: the picker and the receipt show option names / values in the page
// language; selections and `onSelect` keep the canonical (Swedish) keys.

vi.mock('next-intl', () => ({
  useLocale: () => 'de',
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('|')}` : key,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/checkout/confirmation' }));
vi.mock('@/hooks/useStorePrimaryLocale', () => ({ useStorePrimaryLocale: () => 'sv' }));
vi.mock('@/lib/trackEvents', () => ({ whenPurchaseSettled: () => Promise.resolve() }));

const DE = {
  names: { Färg: 'Farbe', Storlek: 'Größe' },
  values: { Färg: { Svart: 'Schwarz', Vit: 'Weiß' }, Storlek: { M: 'Mittel' } },
};
const VARIANTS = [
  { id: 'v1', price: 10, options: { Färg: 'Svart', Storlek: 'M' } },
  { id: 'v2', price: 10, options: { Färg: 'Vit', Storlek: 'M' } },
];
const CONFIGS = [{ name: 'Färg', style: 'color', values: ['Svart', 'Vit'], colorMap: { Svart: '#000000', Vit: '#ffffff' } }];

describe('VariantSelector option labels', () => {
  it('shows translated names and values; onSelect gets canonical ids', () => {
    const onSelect = vi.fn();
    const onSelectionsChange = vi.fn();
    render(
      <VariantSelector
        variants={VARIANTS}
        optionConfigs={CONFIGS}
        onSelect={onSelect}
        onSelectionsChange={onSelectionsChange}
        optionLabels={DE}
        missingAttempt={1}
      />,
    );
    expect(screen.getByRole('group', { name: 'Farbe' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Größe' })).toBeInTheDocument();
    expect(screen.getByText('chooseOptionNamed:Farbe')).toBeInTheDocument();
    expect(screen.getByTitle('Schwarz')).toBeInTheDocument();
    expect(screen.getByText('Weiß')).toBeInTheDocument();
    // Text pill of the size option.
    fireEvent.click(screen.getByRole('button', { name: 'Mittel' }));
    expect(onSelectionsChange).toHaveBeenLastCalledWith({ Storlek: 'M' });
    fireEvent.click(screen.getByTitle('Schwarz'));
    expect(onSelectionsChange).toHaveBeenLastCalledWith({ Storlek: 'M', Färg: 'Svart' });
    expect(onSelect).toHaveBeenLastCalledWith('v1');
    expect(document.querySelector('[data-variant-option="Färg"]')).not.toBeNull();
  });

  it('without labels: the canonical text', () => {
    render(<VariantSelector variants={VARIANTS} optionConfigs={CONFIGS} onSelect={() => {}} />);
    expect(screen.getByRole('group', { name: 'Färg' })).toBeInTheDocument();
    expect(screen.getByTitle('Svart')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
  });
});

describe('OrderReceipt option snapshot', () => {
  const order = (display: unknown): OrderReceiptOrder => ({
    id: 'o1',
    order_number: 'ORD-1',
    subtotal: 10,
    shipping_cost: 0,
    discount_amount: 0,
    total: 10,
    currency: 'EUR',
    items: [
      {
        id: 'i1',
        quantity: 1,
        unit_price: 10,
        product: { translations: [{ locale: 'de', title: 'Tasse' }] },
        variant: { options: { Färg: 'Svart' } },
        variant_options_display: display,
      },
    ],
  });

  it('prefers the buyer-language snapshot', () => {
    render(
      <OrderReceipt
        order={order({ locale: 'de', entries: [{ name: 'Färg', value: 'Svart', name_label: 'Farbe', value_label: 'Schwarz' }] })}
        orderId="o1"
      />,
    );
    expect(screen.getByText('Farbe: Schwarz')).toBeInTheDocument();
  });

  it('falls back to the canonical options', () => {
    render(<OrderReceipt order={order(null)} orderId="o1" />);
    expect(screen.getByText('Färg: Svart')).toBeInTheDocument();
  });
});
