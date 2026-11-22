import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaxIncludedSummary } from './TaxIncludedSummary';
import type { TaxLine } from '@/lib/tax';

vi.mock('next-intl', () => ({
  useLocale: () => 'de',
  useTranslations: (ns?: string) => (key: string, values?: Record<string, string>) => {
    const full = ns ? `${ns}.${key}` : key;
    if (full === 'cart.taxIncludedStatement') return `Inkl. ${values?.label}`;
    if (full === 'cart.taxIncludedGeneric') return 'Inkl. Steuern';
    if (full === 'cart.taxDetails') return 'Details';
    if (full === 'cart.taxIncludedRow') return `Inkl. ${values?.label}`;
    if (full === 'b2b.reverseChargeRow') return 'MwSt. 0 % — Reverse Charge';
    return full;
  },
}));

const line = (over: Partial<TaxLine> = {}): TaxLine => ({
  label: 'MwSt.', rate_bp: 2500, taxable_amount: 47.9, tax_amount: 11.98, ...over,
});
const eur = (n: string) => new RegExp(`^${n}\\s*€$`);

describe('TaxIncludedSummary', () => {
  it('is collapsed by default: statement shown, amount hidden', () => {
    render(<TaxIncludedSummary lines={[line()]} currency="EUR" />);
    expect(screen.getByText('Inkl. MwSt.')).toBeVisible();
    const button = screen.getByRole('button', { name: /Details/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    // The toggle is described by the VAT statement for screen readers.
    expect(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Inkl. MwSt.');
    expect(screen.getByText(eur('11,98'))).not.toBeVisible();
  });

  it('click and keyboard toggle the region (aria-expanded / aria-controls)', async () => {
    const user = userEvent.setup();
    render(<TaxIncludedSummary lines={[line()]} currency="EUR" />);
    const button = screen.getByRole('button', { name: /Details/ });
    const region = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(region).not.toBeNull();
    expect(region).not.toBeVisible();

    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(region).toBeVisible();
    expect(screen.getByText(eur('11,98'))).toBeVisible();
    // Plain rate row: the statement above already says "Inkl."
    expect(screen.getByText('MwSt. 25 %')).toBeVisible();
    expect(screen.queryByText('Inkl. MwSt. 25 %')).toBeNull();

    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.focus();
    await user.keyboard('{Enter}');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    await user.keyboard(' ');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('different labels use the generic statement; same label with two rates → one statement, two rows', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <TaxIncludedSummary lines={[line(), line({ label: 'USt.', rate_bp: 700, tax_amount: 1 })]} currency="EUR" />,
    );
    expect(screen.getByText('Inkl. Steuern')).toBeTruthy();
    unmount();

    render(<TaxIncludedSummary lines={[line(), line({ rate_bp: 700, tax_amount: 1 })]} currency="EUR" />);
    expect(screen.getAllByText('Inkl. MwSt.')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /Details/ }));
    expect(screen.getByText('MwSt. 25 %')).toBeVisible();
    expect(screen.getByText('MwSt. 7 %')).toBeVisible();
  });

  it('an exempt line stays visible without a toggle', () => {
    render(<TaxIncludedSummary lines={[line({ rate_bp: 0, tax_amount: 0, exempt_reason: 'REVERSE_CHARGE' })]} currency="EUR" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('MwSt. 0 % — Reverse Charge')).toBeVisible();
  });

  it('renders nothing without lines', () => {
    const { container } = render(<TaxIncludedSummary lines={[]} currency="EUR" />);
    expect(container.innerHTML).toBe('');
  });
});
