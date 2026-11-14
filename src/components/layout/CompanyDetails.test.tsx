import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useLocale: () => 'ar',
  useTranslations: () => (k: string) => k,
}));

import { CompanyDetails } from './CompanyDetails';

// QA 2026-11-14 (noroj, ar): the Latin postal line "784 40 Borlänge" was
// reordered to "Borlänge 40 784" by the RTL page. Each address line is
// isolated (<bdi>), codes are LTR.
describe('CompanyDetails on an RTL page', () => {
  it('isolates every address line and keeps codes / email left-to-right', () => {
    const { container } = render(
      <div dir="rtl">
        <CompanyDetails
          trader={{
            legal_name: 'Namez AB',
            org_number: '5592951007',
            country: 'SE',
            address_line1: 'Hagavägen 36',
            postal_code: '784 40',
            city: 'Borlänge',
            support_email: 'hello@example.com',
          }}
        />
      </div>,
    );
    expect(screen.getByTestId('company-details')).toBeInTheDocument();
    const lines = Array.from(container.querySelectorAll('address bdi')).map((b) => b.textContent);
    expect(lines.some((l) => l?.includes('784 40'))).toBe(true);
    expect(lines.some((l) => l?.includes('Hagavägen 36'))).toBe(true);
    expect(container.querySelector('a[href^="mailto:"]')).toHaveAttribute('dir', 'ltr');
  });
});
