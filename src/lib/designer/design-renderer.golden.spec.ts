/*
 * Browser-side golden replay (M4.2 WP11, §12.3 G1 on the draw-call level):
 * replays the api renderer goldens
 * (multi-stores-api/src/modules/designer/__fixtures__/golden/renderer/*.json)
 * through THIS repo's renderer mirror with the input shape DesignerCanvas.tsx
 * uses, and checks that every draw-call log hashes to the stored golden.
 * The recorder and fake metrics mirror the api golden kit
 * (`golden-kit.mockspec.ts`) exactly; any drift changes the hashes.
 *
 * Skipped when the sibling api checkout is not present.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  canvasSize,
  renderDesign,
  RENDERER_VERSION,
  type Ctx2D,
  type DesignStateV1,
  type Mode,
  type RenderReport,
  type TemplateSpecV1,
} from './design-renderer';

const here = fileURLToPath(new URL('.', import.meta.url));
const API_DESIGNER = resolve(here, '../../../../multi-stores-api/src/modules/designer');
const GOLDEN_DIR = resolve(API_DESIGNER, '__fixtures__/golden/renderer');
const EXPECTED_DIR = resolve(API_DESIGNER, 'npp/__fixtures__/expected');

/* ── Recorder (same logic as the api golden kit) ─────────────────────── */

type LogEntry = unknown[];

function r6(n: number): number {
  const v = Math.round(n * 1e6) / 1e6;
  return Object.is(v, -0) ? 0 : v;
}
function norm(v: unknown): unknown {
  if (typeof v === 'number') return r6(v);
  if (Array.isArray(v)) return v.map(norm);
  return v;
}

function advance(cp: number): number {
  if (cp === 0xfe0e || cp === 0xfe0f || cp === 0x200d) return 0;
  if (cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf)) return 1.2;
  if (cp === 0x20) return 0.28;
  if (cp >= 0x0590 && cp <= 0x08ff) return 0.5;
  const ch = String.fromCodePoint(cp);
  if ("il.,:;'!|Ij-".includes(ch)) return 0.3;
  if (ch !== ch.toLowerCase()) return 0.68;
  return 0.56;
}
function fontPx(font: string): number {
  const m = /([\d.]+)px/.exec(font);
  return m ? Number(m[1]) : 0;
}
function fakeMeasure(text: string, font: string): number {
  let em = 0;
  for (const ch of text) em += advance(ch.codePointAt(0)!);
  return em * fontPx(font);
}

interface FakeImage {
  __asset: string;
}

class RecordingCtx implements Ctx2D {
  readonly log: LogEntry[] = [];
  private _font = '10px sans-serif';
  private _fillStyle: unknown = '#000000';
  private _strokeStyle: unknown = '#000000';
  private _lineWidth = 1;
  private _textAlign = 'start';
  private _textBaseline = 'alphabetic';
  private _direction = 'inherit';
  private readonly stack: unknown[][] = [];
  private rec(...e: unknown[]) {
    this.log.push(e);
  }
  get font() {
    return this._font;
  }
  set font(v: string) {
    this._font = v;
    this.rec('=font', v);
  }
  get fillStyle() {
    return this._fillStyle;
  }
  set fillStyle(v: unknown) {
    this._fillStyle = v;
    this.rec('=fillStyle', v);
  }
  get strokeStyle() {
    return this._strokeStyle;
  }
  set strokeStyle(v: unknown) {
    this._strokeStyle = v;
    this.rec('=strokeStyle', v);
  }
  get lineWidth() {
    return this._lineWidth;
  }
  set lineWidth(v: number) {
    this._lineWidth = v;
    this.rec('=lineWidth', v);
  }
  get textAlign() {
    return this._textAlign;
  }
  set textAlign(v: string) {
    this._textAlign = v;
    this.rec('=textAlign', v);
  }
  get textBaseline() {
    return this._textBaseline;
  }
  set textBaseline(v: string) {
    this._textBaseline = v;
    this.rec('=textBaseline', v);
  }
  get direction() {
    return this._direction;
  }
  set direction(v: string) {
    this._direction = v;
    this.rec('=direction', v);
  }
  save() {
    this.stack.push([this._font, this._fillStyle, this._strokeStyle, this._lineWidth, this._textAlign, this._textBaseline, this._direction]);
    this.rec('save');
  }
  restore() {
    const s = this.stack.pop();
    if (s) {
      [this._font, this._fillStyle, this._strokeStyle, this._lineWidth, this._textAlign, this._textBaseline, this._direction] = s as [
        string,
        unknown,
        unknown,
        number,
        string,
        string,
        string,
      ];
    }
    this.rec('restore');
  }
  translate(x: number, y: number) {
    this.rec('translate', x, y);
  }
  rotate(a: number) {
    this.rec('rotate', a);
  }
  beginPath() {
    this.rec('beginPath');
  }
  rect(x: number, y: number, w: number, h: number) {
    this.rec('rect', x, y, w, h);
  }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number) {
    this.rec('ellipse', x, y, rx, ry, rot, a0, a1);
  }
  moveTo(x: number, y: number) {
    this.rec('moveTo', x, y);
  }
  lineTo(x: number, y: number) {
    this.rec('lineTo', x, y);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.rec('quadraticCurveTo', cpx, cpy, x, y);
  }
  closePath() {
    this.rec('closePath');
  }
  clip() {
    this.rec('clip');
  }
  fill() {
    this.rec('fill');
  }
  stroke() {
    this.rec('stroke');
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.rec('fillRect', x, y, w, h);
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    this.rec('strokeRect', x, y, w, h);
  }
  clearRect(x: number, y: number, w: number, h: number) {
    this.rec('clearRect', x, y, w, h);
  }
  setLineDash(seg: number[]) {
    this.rec('setLineDash', [...seg]);
  }
  drawImage(img: unknown, dx: number, dy: number, dw: number, dh: number) {
    const id = (img as FakeImage | null)?.__asset;
    this.rec('drawImage', typeof id === 'string' ? id : '?', dx, dy, dw, dh);
  }
  fillText(text: string, x: number, y: number) {
    this.rec('fillText', text, x, y);
  }
  measureText(text: string) {
    const width = fakeMeasure(text, this._font);
    this.rec('measureText', text, width);
    return { width };
  }
}

/* ── Goldens ─────────────────────────────────────────────────────────── */

interface GoldenCase {
  input: {
    state: DesignStateV1;
    mode: Mode;
    scale: number;
    locale?: string;
    ui?: { activeSlotId?: string; uiFontFamily?: string };
  };
  canvas: { width: number; height: number };
  report: RenderReport;
  sha256: string;
}
interface TemplateGolden {
  template: string;
  renderer_version: string;
  cases: Record<string, GoldenCase>;
}

const available = existsSync(GOLDEN_DIR) && existsSync(EXPECTED_DIR);
const files = available ? readdirSync(GOLDEN_DIR).filter((f) => /^template_\d+\.json$/.test(f)).sort() : [];

describe.skipIf(!available)('design-renderer goldens replayed by the web mirror', () => {
  it('has the 10 template goldens', () => {
    expect(files).toHaveLength(10);
  });

  describe.each(files)('%s', (file) => {
    const g = JSON.parse(readFileSync(resolve(GOLDEN_DIR, file), 'utf8')) as TemplateGolden;
    const spec = (JSON.parse(readFileSync(resolve(EXPECTED_DIR, file), 'utf8')) as { spec: TemplateSpecV1 }).spec;

    it('was produced by the same RENDERER_VERSION', () => {
      expect(g.renderer_version).toBe(RENDERER_VERSION);
    });

    it.each(Object.keys(g.cases))('%s: DesignerCanvas input → golden draw log', (key) => {
      const c = g.cases[key];
      const ctx = new RecordingCtx();
      // The exact input shape of DesignerCanvas.tsx (no font lookup).
      const report = renderDesign(ctx, {
        spec,
        state: c.input.state,
        mode: c.input.mode,
        scale: c.input.scale,
        images: { get: (id: string): FakeImage => ({ __asset: id }) },
        locale: c.input.locale,
        ui: {
          activeSlotId: c.input.ui?.activeSlotId,
          emptySlotText: undefined,
          uiFontFamily: 'system-ui',
        },
      });
      const log = ctx.log.map((e) => e.map(norm));
      const sha = createHash('sha256').update(JSON.stringify(log)).digest('hex');
      expect(sha).toBe(c.sha256);
      expect(JSON.parse(JSON.stringify(report))).toEqual(c.report);
      expect(canvasSize(spec, c.input.scale)).toEqual(c.canvas);
    });
  });
});
