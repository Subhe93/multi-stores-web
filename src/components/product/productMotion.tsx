'use client';

// Store motion style on the product page (themes/creative, builder S5).
//
// The product page is one tree of client components (gallery, variant
// picker, quantity, buy button, tabs, lightbox) shared by the monolith
// `product-page` section, the product blocks and the built-in product route.
// The section's `motion` prop is put into a context once at the top of each
// of them (ProductMotionScope / withProductMotion), and the shared parts read
// it with useProductMotion(). Outside a scope the hook returns undefined and
// every helper returns nothing, so a store without the switch (or a section
// with `_style.motion = "none"`) renders exactly today's markup.
//
// Commerce rule: nothing here hides, clips or delays the title, the price,
// the stock message, the buy button or an error. Entrances on this page are
// always the scroll kind (an element on screen when the engine arms it stays
// at rest), never the page-intro kind.

import { createContext, useContext, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { hover, rise, type MotionAttrs, type MotionProp } from '@/themes/creative/recipes';

const ProductMotionContext = createContext<MotionProp>(undefined);

/** Provides the motion style to the product parts below. No element of its own. */
export function ProductMotionScope({ motion, children }: { motion?: MotionProp; children: ReactNode }) {
  if (!motion) return <>{children}</>;
  return <ProductMotionContext.Provider value="scroll">{children}</ProductMotionContext.Provider>;
}

/** 'scroll' inside a product page with the store motion style on, else undefined. */
export function useProductMotion(): MotionProp {
  return useContext(ProductMotionContext);
}

/**
 * Wraps a section component: its `motion` prop becomes the scope of the
 * product parts it renders. Without the prop the component renders as is.
 */
export function withProductMotion<P extends { motion?: MotionProp }>(Component: ComponentType<P>): ComponentType<P> {
  function WithProductMotion(props: P) {
    if (!props.motion) return <Component {...props} />;
    return (
      <ProductMotionScope motion={props.motion}>
        <Component {...props} />
      </ProductMotionScope>
    );
  }
  WithProductMotion.displayName = `WithProductMotion(${Component.displayName || Component.name || 'Component'})`;
  return WithProductMotion;
}

export type PressKind = 'chip' | 'step' | 'buy';

/**
 * Press response of a product control (variant chip, quantity step, buy
 * button): the `press` recipe plus a marker the product stylesheet uses to
 * keep the control's own colour transitions (css/product.css.ts).
 */
export function press(m: MotionProp, kind: PressKind): MotionAttrs {
  return m ? { ...hover(m, 'press'), 'data-cx-pd': kind } : {};
}

/** A named hook for the product stylesheet (tab panel, accordion, lightbox…). */
export function pd(m: MotionProp, name: string): MotionAttrs {
  return m ? { 'data-cx-pd': name } : {};
}

/** Entrance of a block below the buy box: rises when it scrolls into view. */
export function belowFold(m: MotionProp): MotionAttrs {
  return rise(m ? 'scroll' : undefined);
}

/**
 * Content of the buy button in its "added" state. With the motion style on
 * it sits in one inline box that fades in (0.25 s) while the check mark
 * draws (0.45 s); the request never waits for it. Without: the children.
 */
export function AddedLabel({ children }: { children: ReactNode }) {
  const m = useProductMotion();
  if (!m) return <>{children}</>;
  return (
    <span data-cx-pd="added" className="inline-flex items-center gap-2.5">
      {children}
    </span>
  );
}

const SWAP_HOLD_MS = 400;
const SWAP_CAP_MS = 2500;

/**
 * Cross-fade of the gallery's main image. When the shown image changes, the
 * outgoing one stays underneath (`prev`) until the incoming one has loaded
 * and faded in (0.35 s). The first image of the page is never touched (it is
 * the LCP element), and nothing is returned without the motion style.
 *
 * Usage: render `prev` (same element key as when it was current, so its DOM
 * node is kept) before the current image, spread `attrs` on the current one
 * and pass `onLoad` to it. `item` is null while the slot shows no image
 * (a video slide).
 */
export function useImageSwap<T>(
  item: T | null,
  key: string | null,
): { prev: T | null; attrs: MotionAttrs; onLoad: (() => void) | undefined } {
  const on = !!useProductMotion();
  const [shown, setShown] = useState<{ item: T | null; key: string | null }>({ item, key });
  const [prev, setPrev] = useState<T | null>(null);
  const [ready, setReady] = useState(false);

  // Adjust-state-during-render: the outgoing image is known in the same
  // render that shows the incoming one, so no frame is painted without it.
  if (on && shown.key !== key) {
    setShown({ item, key });
    setPrev(item !== null && shown.item !== null ? shown.item : null);
    setReady(false);
  }

  // An image that never reports its load (error, blocked) must not keep the
  // outgoing one forever.
  useEffect(() => {
    if (prev === null) return;
    const cap = setTimeout(() => setReady(true), SWAP_CAP_MS);
    return () => clearTimeout(cap);
  }, [prev]);

  useEffect(() => {
    if (prev === null || !ready) return;
    const done = setTimeout(() => setPrev(null), SWAP_HOLD_MS);
    return () => clearTimeout(done);
  }, [prev, ready]);

  if (!on) return { prev: null, attrs: {}, onLoad: undefined };
  return {
    prev,
    attrs: prev !== null ? { 'data-cx-pd': ready ? 'in' : 'wait' } : {},
    onLoad: () => setReady(true),
  };
}
