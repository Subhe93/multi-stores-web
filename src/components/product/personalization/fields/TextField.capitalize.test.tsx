/*
 * TextField with `ui.transform: 'capitalize'` (M173): the value itself is
 * rewritten on every edit (first letter upper case, the rest lower case), the
 * caret stays where the visitor typed, an open IME composition is left alone,
 * and the uppercase / no-transform fields behave as before.
 */
import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PFieldDef } from '@multi-stores/core/personalization';
import { TextField } from './TextField';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'sv',
}));

const field = (ui: Record<string, unknown>, rules: Record<string, unknown> = {}): PFieldDef =>
  ({
    id: 'n',
    name: 'name',
    type: 'TEXT',
    is_required: false,
    sort_order: 0,
    validation_rules: rules,
    ui,
    translations: [],
  }) as unknown as PFieldDef;

function Harness({ def, seen, initial = '' }: { def: PFieldDef; seen: string[]; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <TextField
      def={def}
      inputId="field-n"
      text={{ label: 'Name' }}
      value={value}
      siblings={[def]}
      siblingValues={{ n: value }}
      required={false}
      locale="sv"
      primaryLocale="sv"
      onChange={(v) => {
        seen.push(v);
        setValue(v);
      }}
    />
  );
}

const input = () => screen.getByRole('textbox') as HTMLInputElement;

/** Simulates the browser state after an edit: new DOM value + caret, then the event. */
function type(value: string, caret = value.length, composing = false) {
  const el = input();
  act(() => {
    el.focus();
    // Set the DOM value the way a keystroke does, then place the caret.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    el.setSelectionRange(caret, caret);
    fireEvent.input(el, { target: { value }, isComposing: composing });
  });
}

describe('TextField: capitalize transform (M173)', () => {
  it('stores and shows the capitalized value while typing', () => {
    const seen: string[] = [];
    render(<Harness def={field({ transform: 'capitalize' })} seen={seen} />);
    type('a');
    expect(input().value).toBe('A');
    type('AN');
    expect(input().value).toBe('An');
    type('aNNA');
    expect(input().value).toBe('Anna');
    expect(seen).toEqual(['A', 'An', 'Anna']);
    // No CSS text-transform: what is shown is the stored text.
    expect(input().className).not.toMatch(/(^|\s)uppercase(\s|$)/);
    expect(input().className).not.toContain('capitalize');
  });

  it('keeps the caret where the visitor typed', () => {
    const seen: string[] = [];
    render(<Harness def={field({ transform: 'capitalize' })} seen={seen} />);
    type('Anna');
    // "X" typed after the first letter: caret is after it (offset 2).
    type('AXnna', 2);
    expect(input().value).toBe('Axnna');
    expect(input().selectionStart).toBe(2);
    expect(input().selectionEnd).toBe(2);
  });

  it('keeps the caret when the transformed value equals the previous one', () => {
    const seen: string[] = [];
    render(<Harness def={field({ transform: 'capitalize' })} seen={seen} />);
    type('Anna');
    // The second letter replaced by its capital: the result is "Anna" again.
    type('ANna', 2);
    expect(input().value).toBe('Anna');
    expect(input().selectionStart).toBe(2);
  });

  it('leaves an open IME composition alone and transforms when it ends', () => {
    const seen: string[] = [];
    render(<Harness def={field({ transform: 'capitalize' })} seen={seen} />);
    type('aNN', 3, true);
    expect(input().value).toBe('aNN');
    act(() => {
      fireEvent.compositionEnd(input());
    });
    expect(input().value).toBe('Ann');
  });

  it('applies after the allowed-chars filter and the max length', () => {
    const seen: string[] = [];
    render(<Harness def={field({ transform: 'capitalize' }, { max_length: 4, allowed_chars: 'A-Za-z' })} seen={seen} />);
    type('1aNNA-MARIA');
    expect(input().value).toBe('Anna');
  });

  it('normalises a value that arrives without typing (URL prefill)', () => {
    const seen: string[] = [];
    render(<Harness def={field({ transform: 'capitalize' })} seen={seen} initial="ANNA" />);
    expect(input().value).toBe('Anna');
    expect(seen).toEqual(['Anna']);
  });

  it('leaves a prefilled value alone for uppercase and no transform', () => {
    const seenUpper: string[] = [];
    const { unmount } = render(<Harness def={field({ transform: 'uppercase' })} seen={seenUpper} initial="aNNa" />);
    expect(input().value).toBe('aNNa');
    expect(seenUpper).toEqual([]);
    unmount();
    const seenNone: string[] = [];
    render(<Harness def={field({})} seen={seenNone} initial="aNNa" />);
    expect(input().value).toBe('aNNa');
    expect(seenNone).toEqual([]);
  });

  it('uppercase stays CSS only and no transform stays raw', () => {
    const seenUpper: string[] = [];
    const { unmount } = render(<Harness def={field({ transform: 'uppercase' })} seen={seenUpper} />);
    type('aNNa');
    expect(input().value).toBe('aNNa');
    expect(seenUpper).toEqual(['aNNa']);
    expect(input().className).toMatch(/(^|\s)uppercase(\s|$)/);
    unmount();

    const seenNone: string[] = [];
    render(<Harness def={field({})} seen={seenNone} />);
    type('aNNa');
    expect(input().value).toBe('aNNa');
    expect(seenNone).toEqual(['aNNa']);
    expect(input().className).not.toMatch(/(^|\s)uppercase(\s|$)/);
  });
});
