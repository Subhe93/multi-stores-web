// Colour tables of "hero-dawn": the five owner colour groups and every
// shade the stylesheet draws (see sections/tones.ts). Kept apart from the
// stylesheet so the light behaviour can read the groups without the CSS.

import type { ToneGroup, ToneTable } from './tones';

export const HD_PREFIX = '--cx-hd-c-';

/** Owner colours of the hero: settings key and built-in colour. */
export const HD_GROUPS: Record<string, ToneGroup> = {
  sky: { setting: 'sky_color', base: [17, 17, 17] },
  warm: { setting: 'warm_color', base: [51, 25, 15] },
  gold: { setting: 'gold_color', base: [201, 165, 106] },
  accent: { setting: 'accent_color', base: [182, 0, 24] },
  cream: { setting: 'cream_color', base: [247, 244, 239] },
};

/** Every shade the hero draws, by group. */
export const HD_TONES: ToneTable = {
  ink: ['sky', [17, 17, 17]],
  sky0: ['sky', [13, 13, 13]],
  sky1: ['sky', [19, 17, 16]],
  archbg: ['sky', [27, 23, 20]],
  scrim: ['sky', [8, 7, 7]],
  scrim2: ['sky', [10, 9, 9]],
  ground: ['sky', [14, 13, 13]],
  sky2: ['warm', [36, 22, 18]],
  sky3: ['warm', [51, 25, 15]],
  cardbg: ['warm', [42, 26, 20]],
  gold: ['gold', [201, 165, 106]],
  glow: ['gold', [236, 196, 132]],
  copper: ['gold', [206, 120, 70]],
  warmlt: ['gold', [255, 200, 130]],
  halo: ['gold', [244, 231, 201]],
  halo2: ['gold', [220, 170, 100]],
  beam: ['gold', [255, 214, 150]],
  archlt: ['gold', [255, 196, 120]],
  ray0: ['gold', [230, 204, 151]],
  ray1: ['gold', [184, 149, 94]],
  ray2: ['gold', [122, 94, 54]],
  disc2: ['gold', [163, 130, 80]],
  red: ['accent', [182, 0, 24]],
  redd: ['accent', [142, 0, 19]],
  cream: ['cream', [247, 244, 239]],
};
