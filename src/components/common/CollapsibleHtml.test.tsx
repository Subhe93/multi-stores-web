import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CollapsibleHtml } from './CollapsibleHtml';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (key === 'showMore' ? 'Visa mer' : 'Visa mindre'),
}));

// jsdom has no layout: report a tall element so the text counts as overflowing.
Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
  configurable: true,
  get: () => 1000,
});

const LONG = `<h2>Svensk present</h2>${'<p>Lorem ipsum dolor sit amet.</p>'.repeat(20)}`;

describe('CollapsibleHtml', () => {
  it('keeps the full text in the DOM while collapsed (indexable)', () => {
    render(<CollapsibleHtml html={LONG} />);
    expect(document.body.innerHTML).toContain('Svensk present');
    expect(document.querySelectorAll('p').length).toBe(20);
  });

  it('starts collapsed with a fade and a "Show more" button', () => {
    render(<CollapsibleHtml html={LONG} lines={3} />);
    const button = screen.getByRole('button', { name: /Visa mer/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const region = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(region.style.maxHeight).toBe('3lh');
  });

  it('expands and collapses again', () => {
    render(<CollapsibleHtml html={LONG} />);
    const button = screen.getByRole('button', { name: /Visa mer/ });
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Visa mindre/ })).toBeTruthy();
    const region = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(region.style.maxHeight).toBe('none');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
