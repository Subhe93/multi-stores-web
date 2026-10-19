'use client';

// ── Designer: live canvas (M4.2 §7.1/§7.2, M5.5 NPP parity) ───────────────
// DPR-aware backing store (≤ 1400 px wide), RAF-coalesced renderDesign, and
// pointer handling like NPP: a photo pans as soon as it is dragged (no
// activation tap). On touch the first 4 px decide: mostly vertical → the
// page scrolls (`touch-action: pan-y` lets the browser take it), otherwise
// the photo pans; two fingers pinch-zoom and rotate; mouse wheel zooms,
// Shift+wheel rotates; double-tap resets. Keyboard: Enter cycles photos,
// arrows pan, +/- zoom, [ ] rotate, 0 reset, Escape deselects. The canvas
// is the print layout, so it is never mirrored in RTL (`dir="ltr"`).

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  canvasSize,
  DEFAULT_ADJ,
  renderDesign,
  type DesignStateV1,
  type ImageLookup,
  type ImageSlotElement,
  type Mode,
  type FontLookup,
  type PhotoAdj,
  type RenderReport,
  type TemplateSpecV1,
} from '@multi-stores/core/designer';
import {
  backingScale,
  clientToMm,
  hitTest,
  keyAdj,
  limitsOf,
  panByDrag,
  pinchStart,
  pinchUpdate,
  pxToMm,
  touchDirection,
  wheelAdj,
  type PinchStart,
  type Point,
} from '@/lib/designer/gestures';

interface Props {
  spec: TemplateSpecV1;
  state: DesignStateV1;
  images: ImageLookup;
  /** Which template faces are loaded: text of a missing face is skipped and
   *  reported (never fitted with a fallback font). */
  fonts?: FontLookup;
  /** Bumps when images or fonts finish loading. */
  renderKey?: string | number;
  mode?: Mode;
  locale?: string;
  interactive?: boolean;
  activeSlotId?: string | null;
  onActivate?: (slotId: string | null) => void;
  onAdjChange?: (slotId: string, adj: PhotoAdj) => void;
  /** First pan of a photo by dragging (the page hides its "drag the photo" hint). */
  onDragStart?: () => void;
  onEmptySlotTap?: (slotId: string) => void;
  onTextTap?: (elementId: string) => void;
  onReport?: (report: RenderReport) => void;
  emptySlotText?: (el: ImageSlotElement) => string;
  label: string;
  keyboardHelp?: string;
  /** Max backing width in device px. */
  maxPx?: number;
  className?: string;
}

const TAP_SLOP_PX = 6;
const DOUBLE_TAP_MS = 320;

function slotsOf(spec: TemplateSpecV1): ImageSlotElement[] {
  const sf = (spec.surfaces || []).find((s) => s.key === 'front');
  return (sf?.elements || []).filter((e): e is ImageSlotElement => e.type === 'image_slot');
}

export function DesignerCanvas({
  spec,
  state,
  images,
  fonts,
  renderKey,
  mode = 'edit',
  locale,
  interactive = true,
  activeSlotId = null,
  onActivate,
  onAdjChange,
  onDragStart,
  onEmptySlotTap,
  onTextTap,
  onReport,
  emptySlotText,
  label,
  keyboardHelp,
  maxPx = 1400,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(0);
  const helpId = useId();

  // Latest props for the event handlers and the RAF callback.
  const live = useRef({ spec, state, images, fonts, mode, locale, activeSlotId, emptySlotText, onReport });
  useLayoutEffect(() => {
    live.current = { spec, state, images, fonts, mode, locale, activeSlotId, emptySlotText, onReport };
  });

  // ── Size ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(backingScale(w, window.devicePixelRatio || 1, spec.width, maxPx));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [spec.width, maxPx]);

  // ── Render (one per frame at most) ────────────────────────────────────
  const frame = useRef<number | null>(null);
  const draw = useCallback(() => {
    frame.current = null;
    const canvas = canvasRef.current;
    if (!canvas || !(scale > 0)) return;
    const { width, height } = canvasSize(live.current.spec, scale);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    const report = renderDesign(ctx, {
      spec: live.current.spec,
      state: live.current.state,
      mode: live.current.mode,
      scale,
      images: live.current.images,
      ...(live.current.fonts ? { fonts: live.current.fonts } : {}),
      locale: live.current.locale,
      ui: {
        activeSlotId: live.current.activeSlotId ?? undefined,
        emptySlotText: live.current.emptySlotText,
        uiFontFamily: 'system-ui',
      },
    });
    live.current.onReport?.(report);
  }, [scale]);

  useEffect(() => {
    if (frame.current === null) frame.current = requestAnimationFrame(draw);
  }, [draw, spec, state, images, fonts, mode, locale, activeSlotId, renderKey]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // ── Pointer gestures ──────────────────────────────────────────────────
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{
    slotId: string | null;
    tapTarget: { kind: 'slot' | 'text' | 'none'; id: string | null } | null;
    start: Point;
    last: Point;
    moved: boolean;
    pinch: PinchStart | null;
    /** Touch pointer: scroll-or-pan not decided yet (first 4 px). */
    undecided: boolean;
    /** A pan was emitted during this gesture. */
    dragged: boolean;
  } | null>(null);
  const lastTap = useRef<{ id: string; at: number } | null>(null);

  const slotById = useCallback(
    (id: string | null) => (id ? slotsOf(live.current.spec).find((s) => s.id === id) ?? null : null),
    [],
  );

  const currentAdj = useCallback(
    (slotId: string): PhotoAdj | null => live.current.state.photos?.[slotId]?.adj ?? null,
    [],
  );

  const emit = useCallback(
    (slotId: string, adj: PhotoAdj) => {
      onAdjChange?.(slotId, adj);
    },
    [onAdjChange],
  );

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2 && g?.slotId) {
      const [a, b] = [...pointers.current.values()];
      const adj = currentAdj(g.slotId);
      if (adj && a && b) {
        g.pinch = pinchStart(a, b, adj);
        g.moved = true;
        g.undecided = false;
        g.tapTarget = null;
        canvas.setPointerCapture(e.pointerId);
      }
      return;
    }
    if (pointers.current.size > 1) return;
    const rect = canvas.getBoundingClientRect();
    const hit = hitTest(live.current.spec, clientToMm(e.clientX, e.clientY, rect, live.current.spec));
    const p = { x: e.clientX, y: e.clientY };
    const base = { start: p, last: p, moved: false, pinch: null, undecided: false, dragged: false };
    if (hit?.type === 'image_slot') {
      // A photo pans right away (NPP): no activation tap on any pointer. On
      // touch the direction of the first move decides between page scroll
      // and pan (see onPointerMove).
      const hasPhoto = Boolean(live.current.state.photos?.[hit.id]);
      if (hasPhoto && live.current.activeSlotId !== hit.id) onActivate?.(hit.id);
      gesture.current = { ...base, slotId: hasPhoto ? hit.id : null, tapTarget: { kind: 'slot', id: hit.id }, undecided: hasPhoto && e.pointerType === 'touch' };
      if (hasPhoto) {
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    } else if (hit?.type === 'text') {
      gesture.current = { ...base, slotId: null, tapTarget: { kind: 'text', id: hit.id } };
    } else {
      gesture.current = { ...base, slotId: null, tapTarget: { kind: 'none', id: null } };
    }
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const p = { x: e.clientX, y: e.clientY };
    if (!g.moved && Math.hypot(p.x - g.start.x, p.y - g.start.y) > TAP_SLOP_PX) g.moved = true;
    if (!g.slotId) return;
    const slot = slotById(g.slotId);
    const photo = live.current.state.photos?.[g.slotId];
    if (!slot || !photo) return;
    const limits = limitsOf(slot);
    if (g.pinch && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) emit(slot.id, pinchUpdate(g.pinch, a, b, photo.adj, limits));
      return;
    }
    if (g.undecided) {
      // NPP's touch rule: mostly vertical → let the page scroll (the browser
      // usually cancels the pointer itself under `touch-action: pan-y`;
      // this covers the ones that do not), otherwise pan from the touch point.
      const decision = touchDirection(p.x - g.start.x, p.y - g.start.y);
      if (decision === 'undecided') return;
      g.undecided = false;
      if (decision === 'scroll') {
        g.slotId = null;
        g.tapTarget = null;
        try {
          canvasRef.current?.releasePointerCapture(e.pointerId);
        } catch {
          // Capture already gone (pointercancel): nothing to release.
        }
        return;
      }
      g.last = g.start;
    }
    const rect = canvasRef.current!.getBoundingClientRect();
    const dx = pxToMm(p.x - g.last.x, rect.width, live.current.spec.width);
    const dy = pxToMm(p.y - g.last.y, rect.height, live.current.spec.height);
    g.last = p;
    if (dx || dy) {
      if (!g.dragged) {
        g.dragged = true;
        onDragStart?.();
      }
      emit(slot.id, panByDrag(slot, photo.width, photo.height, photo.adj, dx, dy));
    }
  };

  const endPointer = (e: PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (pointers.current.size > 0) {
      // One finger left after a pinch: continue as a drag from here.
      if (g.pinch) {
        g.pinch = null;
        const rest = [...pointers.current.values()][0];
        if (rest) g.last = rest;
      }
      return;
    }
    gesture.current = null;
    if (cancelled || g.moved || !g.tapTarget) return;
    const target = g.tapTarget;
    if (target.kind === 'slot' && target.id) {
      const hasPhoto = Boolean(live.current.state.photos?.[target.id]);
      const now = Date.now();
      if (hasPhoto && lastTap.current?.id === target.id && now - lastTap.current.at < DOUBLE_TAP_MS) {
        const slot = slotById(target.id);
        emit(target.id, { ...(slot?.default_adj ?? DEFAULT_ADJ) });
        lastTap.current = null;
        return;
      }
      lastTap.current = { id: target.id, at: now };
      if (!hasPhoto) onEmptySlotTap?.(target.id);
      else onActivate?.(target.id);
    } else if (target.kind === 'text' && target.id) {
      onActivate?.(null);
      onTextTap?.(target.id);
    } else {
      onActivate?.(null);
    }
  };

  // Wheel needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      const id = live.current.activeSlotId;
      const photo = id ? live.current.state.photos?.[id] : undefined;
      const slot = slotById(id ?? null);
      if (!id || !photo || !slot) return;
      e.preventDefault();
      emit(id, wheelAdj(photo.adj, e.deltaY, e.shiftKey, limitsOf(slot)));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [interactive, emit, slotById]);

  const onKeyDown = (e: KeyboardEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const withPhotos = slotsOf(spec).filter((s) => state.photos?.[s.id]);
    if (e.key === 'Enter' || e.key === ' ') {
      if (withPhotos.length === 0) return;
      e.preventDefault();
      const i = withPhotos.findIndex((s) => s.id === activeSlotId);
      onActivate?.(withPhotos[(i + 1) % withPhotos.length]!.id);
      return;
    }
    if (e.key === 'Escape' && activeSlotId) {
      e.preventDefault();
      e.stopPropagation();
      onActivate?.(null);
      return;
    }
    const slot = slotById(activeSlotId);
    const photo = activeSlotId ? state.photos?.[activeSlotId] : undefined;
    if (!slot || !photo) return;
    const next = keyAdj(e.key, photo.adj, e.shiftKey, limitsOf(slot), slot.default_adj ?? DEFAULT_ADJ);
    if (next) {
      e.preventDefault();
      emit(slot.id, next);
    }
  };

  const ratio = spec.width / spec.height;

  return (
    <div ref={wrapRef} dir="ltr" className={className} style={{ aspectRatio: String(ratio) }}>
      <canvas
        ref={canvasRef}
        role={interactive ? 'application' : 'img'}
        aria-label={label}
        aria-describedby={interactive && keyboardHelp ? helpId : undefined}
        tabIndex={interactive ? 0 : -1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onKeyDown={onKeyDown}
        className={`block h-full w-full rounded-md shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          interactive ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={{
          // Vertical swipes stay page scrolls (NPP); horizontal ones pan the
          // photo and two fingers pinch, both handled here.
          touchAction: 'pan-y',
          background: '#fff',
        }}
      />
      {interactive && keyboardHelp && (
        <p id={helpId} className="sr-only">
          {keyboardHelp}
        </p>
      )}
    </div>
  );
}
