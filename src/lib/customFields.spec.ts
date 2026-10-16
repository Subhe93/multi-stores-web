import { describe, expect, it } from 'vitest';
import { snapshotLabel, sortOrderFieldValues } from './customFields';

describe('snapshotLabel (order snapshot, M4.0 §6)', () => {
  const live = { name: 'name_1', translations: [{ locale: 'en', label: 'Live label', option_labels: { red: 'Red' } }] };

  it('prefers the frozen label and display value: locale → primary → en → first', () => {
    const row = {
      value: 'red',
      field_label: { sv: 'Färg', en: 'Color' },
      display_value: { sv: 'Röd', en: 'Red' },
      custom_field: live,
    };
    expect(snapshotLabel(row, 'sv', 'en')).toEqual({ label: 'Färg', value: 'Röd' });
    expect(snapshotLabel(row, 'de', 'sv')).toEqual({ label: 'Färg', value: 'Röd' });
    expect(snapshotLabel(row, 'de', 'fr')).toEqual({ label: 'Color', value: 'Red' });
    expect(snapshotLabel({ field_label: { tr: 'Renk' } }, 'de')).toEqual({ label: 'Renk', value: '' });
  });

  it('a deleted field keeps its snapshot label', () => {
    expect(snapshotLabel({ value: 'OLLE', field_label: { sv: 'Andra texten' }, custom_field: null }, 'sv')).toEqual({
      label: 'Andra texten',
      value: 'OLLE',
    });
  });

  it('legacy rows without snapshot fall back to the live field, then field_name, then —', () => {
    expect(snapshotLabel({ value: 'red', custom_field: live }, 'en')).toEqual({ label: 'Live label', value: 'Red' });
    expect(snapshotLabel({ value: 'x', field_name: 'name_2' }, 'en')).toEqual({ label: 'name_2', value: 'x' });
    expect(snapshotLabel({}, 'en')).toEqual({ label: '—', value: '' });
  });

  it('sorts by sort_order, missing last, stable otherwise', () => {
    const rows = [{ id: 'a' }, { id: 'b', sort_order: 2 }, { id: 'c', sort_order: 1 }, { id: 'd' }];
    expect(sortOrderFieldValues(rows).map((r) => r.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});
