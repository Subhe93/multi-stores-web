'use client';

// Lazy client chunks of the sections that still animate with framer-motion.
// Like product/lazy.tsx: the import() must live in a client module so each
// section (and framer with it) becomes an async chunk fetched only by pages
// that render it, instead of joining the store layout's shared client bundle.
// Default `ssr: true`: the server HTML is unchanged.

import dynamic from 'next/dynamic';

export const AnimatedFeatures = dynamic(() =>
  import('./AnimatedFeatures.client').then((m) => m.AnimatedFeaturesMotion),
);
export const AuroraHero = dynamic(() => import('./AuroraHero.client').then((m) => m.AuroraHeroMotion));
export const ImageHotspots = dynamic(() => import('./ImageHotspots.client').then((m) => m.ImageHotspotsMotion));
export const MasonryGallery = dynamic(() => import('./MasonryGallery.client').then((m) => m.MasonryGalleryMotion));
export const StickyCtaBar = dynamic(() => import('./StickyCtaBar.client').then((m) => m.StickyCtaBarMotion));
