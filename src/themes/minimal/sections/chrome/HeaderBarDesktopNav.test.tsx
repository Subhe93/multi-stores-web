import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HeaderBarDesktopNav, needsMegaPanel, type DesktopNavItem } from './HeaderBarDesktopNav.client';

// The mega-style desktop nav: a top-level item whose children have children
// opens a full-width column panel; one whose children are leaves keeps the
// simple dropdown; the chevron toggles and Escape closes.

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const gifts: DesktopNavItem = {
  label: 'Presenter till vem',
  url: '#',
  children: [
    {
      label: 'För honom',
      url: '/collections/for-honom',
      children: [{ label: 'Klockor', url: '/collections/klockor' }],
    },
    {
      label: 'För henne',
      url: '#',
      children: [{ label: 'Smycken', url: '/collections/smycken' }],
    },
  ],
};
const about: DesktopNavItem = {
  label: 'Om oss',
  url: '/pages/about',
  children: [{ label: 'Kontakt', url: '/pages/contact' }],
};
const home: DesktopNavItem = { label: 'Hem', url: '/' };

function renderNav() {
  return render(
    <HeaderBarDesktopNav items={[home, gifts, about]} bg="#fff" borderColor="#eee" accent="#000" />,
  );
}

describe('needsMegaPanel', () => {
  it('is true only when some child has children of its own', () => {
    expect(needsMegaPanel(gifts)).toBe(true);
    expect(needsMegaPanel(about)).toBe(false);
    expect(needsMegaPanel(home)).toBe(false);
  });
});

describe('HeaderBarDesktopNav', () => {
  it('renders level-2 items as column headings (linked only with a real URL)', () => {
    renderNav();
    // The closed panel is aria-hidden, so open it before querying by role.
    fireEvent.click(screen.getByRole('button', { name: 'Presenter till vem' }));
    // Linked heading: real URL.
    const honom = screen.getByRole('link', { name: 'För honom' });
    expect(honom).toHaveAttribute('href', '/collections/for-honom');
    // Plain heading: url '#'.
    expect(screen.getByText('För henne').tagName).toBe('H4');
    expect(screen.queryByRole('link', { name: 'För henne' })).toBeNull();
    // Level-3 links live under their heading.
    expect(screen.getByRole('link', { name: 'Klockor' })).toHaveAttribute('href', '/collections/klockor');
  });

  it('toggles the mega panel with the chevron button and closes on Escape', () => {
    renderNav();
    const toggle = screen.getByRole('button', { name: 'Presenter till vem' });
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel.className).toContain('invisible');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(panel.className).toContain('visible');
    expect(panel.className).not.toContain('invisible');

    fireEvent.keyDown(toggle, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel.className).toContain('invisible');
  });

  it('keeps a simple dropdown for an item without a third level', () => {
    renderNav();
    const toggle = screen.getByRole('button', { name: 'Om oss' });
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(panel.className).toContain('hidden');
    expect(panel.className).toContain('inset-s-0');
    fireEvent.click(toggle);
    expect(panel.className).toContain('block');
    expect(screen.getByRole('link', { name: 'Kontakt' })).toHaveAttribute('href', '/pages/contact');
  });

  it('opens on trigger focus (keyboard users)', () => {
    renderNav();
    const trigger = screen.getByRole('link', { name: 'Presenter till vem' });
    fireEvent.focus(trigger);
    expect(screen.getByRole('button', { name: 'Presenter till vem' })).toHaveAttribute('aria-expanded', 'true');
  });
});
