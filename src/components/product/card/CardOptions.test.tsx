import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/i18n/messages/en.json';
import ar from '@/i18n/messages/ar.json';
import { CardSizeLine } from './CardSizeLine';
import { CardSwatchList } from './CardSwatchList';

vi.mock('@/components/StoreImage', () => ({
  StoreImage: ({ src, alt, loading }: { src: string; alt: string; loading?: 'lazy' | 'eager' }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading={loading} />
  ),
}));

function mount(ui: ReactNode, locale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('CardSwatchList', () => {
  it('draws one dot per colour, names them in hidden text and has nothing to focus', () => {
    const { container } = mount(
      <CardSwatchList
        swatches={{
          items: [
            { value: 'Sand', css: '#d8c7a8' },
            { value: 'Duo', css: '#111111', css2: '#ffffff' },
            { value: 'Dune', image: '/uploads/dune.jpg' },
          ],
          more: 2,
          total: 5,
        }}
      />,
    );
    const dots = container.querySelectorAll('.pcopt-dot');
    expect(dots).toHaveLength(3);
    dots.forEach((d) => expect(d.getAttribute('aria-hidden')).toBe('true'));
    expect((dots[0] as HTMLElement).style.backgroundColor).not.toBe('');
    expect((dots[1] as HTMLElement).getAttribute('style')).toContain('linear-gradient');
    expect(dots[2].querySelector('img')?.getAttribute('loading')).toBe('lazy');
    expect(container.querySelector('.sr-only')?.textContent).toBe('Colours: Sand, Duo, Dune, +2 more');
    expect(container.querySelector('.pcopt-more')?.textContent).toBe('+2');
    expect(container.querySelector('a, button, [tabindex]')).toBeNull();
  });

  it('prints the number of colours when no value resolves', () => {
    const { container } = mount(<CardSwatchList swatches={{ items: [], more: 0, total: 3 }} />);
    expect(container.textContent).toBe('3 colours');
    expect(container.querySelector('.pcopt-dot')).toBeNull();
  });

  it('renders nothing without colours', () => {
    const { container } = mount(<CardSwatchList swatches={{ items: [], more: 0, total: 0 }} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('CardSizeLine', () => {
  const sizes = {
    items: [
      { value: 'S', available: true },
      { value: 'M', available: false },
      { value: 'L', available: true },
    ],
    more: 1,
  };

  it('strikes sold-out sizes and says so in the hidden text', () => {
    const { container } = mount(<CardSizeLine sizes={sizes} />);
    const items = container.querySelectorAll('.pcopt-size');
    expect(Array.from(items).map((n) => n.textContent)).toEqual(['S', 'M', 'L']);
    expect(items[1].hasAttribute('data-out')).toBe(true);
    expect(items[0].hasAttribute('data-out')).toBe(false);
    expect(container.querySelector('.sr-only')?.textContent).toBe('Sizes: S, M (sold out), L, +1 more');
    expect(container.querySelector('a, button, [tabindex]')).toBeNull();
  });

  it('speaks Arabic', () => {
    const { container } = mount(<CardSizeLine sizes={sizes} />, 'ar');
    const text = container.querySelector('.sr-only')?.textContent ?? '';
    expect(text.startsWith('المقاسات:')).toBe(true);
    expect(text).toContain('M (نفد)');
  });

  it('renders nothing without sizes', () => {
    const { container } = mount(<CardSizeLine sizes={{ items: [], more: 0 }} />);
    expect(container.innerHTML).toBe('');
  });
});
