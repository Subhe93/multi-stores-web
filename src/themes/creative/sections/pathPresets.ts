// STUB (owner: B3). Platform geometry of the motion-path presets (wave,
// zigzag, straight), see the contract section 4.6.

export type PathShape = 'wave' | 'zigzag' | 'straight';

export function pathShape(raw: unknown): PathShape {
  return raw === 'zigzag' || raw === 'straight' ? raw : 'wave';
}
