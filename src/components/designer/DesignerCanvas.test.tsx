import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SPEC } from '@/test/designer-fixtures';
import { DesignerCanvas } from './DesignerCanvas';

const images = { get: () => undefined };
const photo = { asset_id: 'a1', width: 800, height: 600, adj: { zoom: 1, rot: 0, panX: 0.5, panY: 0.5 } };

describe('DesignerCanvas (smoke)', () => {
  it('renders an LTR application canvas with its label and keyboard help', () => {
    render(
      <DesignerCanvas
        spec={SPEC}
        state={{ v: 1, texts: {}, photos: {} }}
        images={images}
        label="Design preview"
        keyboardHelp="Press Enter to select a photo."
      />,
    );
    const canvas = screen.getByRole('application', { name: 'Design preview' });
    expect(canvas).toHaveAttribute('tabindex', '0');
    expect(canvas.parentElement).toHaveAttribute('dir', 'ltr');
    expect(canvas).toHaveAccessibleDescription('Press Enter to select a photo.');
    // Page scroll stays possible until a photo is selected.
    expect(canvas.style.touchAction).toBe('pan-y');
  });

  it('is a plain image in proof mode', () => {
    render(<DesignerCanvas spec={SPEC} state={{ v: 1, texts: {}, photos: {} }} images={images} mode="proof" interactive={false} label="Proof" />);
    const img = screen.getByRole('img', { name: 'Proof' });
    expect(img).toHaveAttribute('tabindex', '-1');
  });

  it('Enter selects the next photo slot and Escape deselects it', () => {
    const onActivate = vi.fn();
    const { rerender } = render(
      <DesignerCanvas spec={SPEC} state={{ v: 1, texts: {}, photos: { photo } }} images={images} label="Design preview" onActivate={onActivate} />,
    );
    const canvas = screen.getByRole('application');
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(onActivate).toHaveBeenLastCalledWith('photo');
    rerender(
      <DesignerCanvas
        spec={SPEC}
        state={{ v: 1, texts: {}, photos: { photo } }}
        images={images}
        label="Design preview"
        activeSlotId="photo"
        onActivate={onActivate}
      />,
    );
    expect(screen.getByRole('application').style.touchAction).toBe('none');
    fireEvent.keyDown(canvas, { key: 'Escape' });
    expect(onActivate).toHaveBeenLastCalledWith(null);
  });
});
