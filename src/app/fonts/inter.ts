// Self-hosted copies of the Google Fonts files that next/font/google used to
// download at build time, so builds never depend on fonts.googleapis.com.
// Each family keeps the exact Google subset files (latin, latin-ext and, where
// relevant, arabic) and their unicode-range, declared as one localFont call
// per subset under the same font-family name, in the same order as the Google
// CSS. The exported (latin) call carries the className / CSS variable and
// names the Arial-based '<Family> Fallback' face defined in
// inter-fallback.css; the other calls only add their @font-face rules.
// Preload mirrors the old `subsets` option. Licences: OFL.txt in each folder.
/* eslint-disable @typescript-eslint/no-unused-vars -- the non-exported subset calls only register their @font-face rules */
import localFont from 'next/font/local';
import './inter-fallback.css';

// The exported fonts are bound to the family name because next/font names the
// class font-family after the binding, so it stays 'Inter', 'Inter Fallback'
// exactly as with next/font/google.

// Root UI font, shared by the root layout and global-error.
const interLatinExt = localFont({
  src: './inter/inter-latin-ext.woff2',
  weight: '100 900',
  style: 'normal',
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: 'font-family', value: 'Inter' },
    { prop: 'unicode-range', value: 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF' },
  ],
});
const Inter = localFont({
  src: './inter/inter-latin.woff2',
  weight: '100 900',
  style: 'normal',
  preload: true,
  adjustFontFallback: false,
  fallback: ['Inter Fallback'],
  declarations: [
    { prop: 'font-family', value: 'Inter' },
    { prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD' },
  ],
});

export { Inter as inter };
