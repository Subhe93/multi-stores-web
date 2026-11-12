import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { EmbedCode } from './EmbedCode.client';

const base = { content: {}, locale: 'en', primaryLocale: 'en', storeSlug: 'demo' };

describe('EmbedCode', () => {
  it('keeps its spacing and placeholder height on content pages', () => {
    const { container } = render(
      <EmbedCode {...base} settings={{ mode: 'isolated', js: 'console.log(1)', min_height: 0 }} />,
    );
    expect(container.querySelector('section')?.className).toBe('py-6');
    const frame = container.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.style.height).toBe('280px');
    expect(frame.getAttribute('loading')).toBe('lazy');
  });

  it('collapses a script-only isolated embed in the header / footer', () => {
    const { container } = render(
      <EmbedCode {...base} chrome settings={{ mode: 'isolated', js: 'console.log(1)', min_height: 0 }} />,
    );
    const section = container.querySelector('section') as HTMLElement;
    expect(section.className).toBe('');
    const frame = container.querySelector('iframe') as HTMLIFrameElement;
    expect(frame.style.height).toBe('0px');
    expect(frame.getAttribute('loading')).toBe('eager');
  });

  it('renders no padded box for a style-only inline embed in the header / footer', () => {
    const { container } = render(
      <EmbedCode {...base} chrome settings={{ mode: 'inline', css: 'body{color:red}', min_height: 0 }} />,
    );
    const section = container.querySelector('section') as HTMLElement;
    expect(section.className).toBe('');
    expect(section.getAttribute('style')).toBeNull();
    expect(section.querySelector('style')?.textContent).toBe('body{color:red}');
    expect(section.textContent).toBe('body{color:red}');
  });

  it('shows the placeholder on content pages but nothing in the header / footer when empty', () => {
    expect(render(<EmbedCode {...base} settings={{}} />).container.textContent).toContain('Paste HTML');
    expect(render(<EmbedCode {...base} chrome settings={{}} />).container.innerHTML).toBe('');
  });
});
