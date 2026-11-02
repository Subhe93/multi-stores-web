'use client';

import { useEffect, useRef } from 'react';

/**
 * Raw WebGL2 fullscreen-triangle fragment shader: slow "ivory silk" fbm with
 * faint teal and amber light drifting through it. Luminance is kept close to
 * the ivory paper so copy stays legible without a heavy scrim. Pauses when
 * off-screen, clamps DPR, respects reduced motion (static frame) and falls
 * back to the CSS gradient behind it when WebGL is unavailable.
 */
const VERT = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main(){ gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform float uTime;
uniform float uDark;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for(int i=0;i<5;i++){ v += a*noise(p); p = r*p*2.03; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = uv * vec2(uRes.x/uRes.y, 1.0);
  float t = uTime * 0.045;
  vec2 q = vec2(fbm(p*1.6 + vec2(0.0, t)), fbm(p*1.6 + vec2(5.2, -t*0.8)));
  float f = fbm(p*2.2 + 2.4*q + vec2(t*0.6, -t*0.4));
  float silk = smoothstep(0.25, 0.85, f);
  vec3 ivory = vec3(0.969, 0.957, 0.925);
  vec3 ivory2 = vec3(0.925, 0.905, 0.862);
  vec3 teal = vec3(0.082, 0.722, 0.651);
  vec3 amber = vec3(0.957, 0.710, 0.267);
  vec3 navy = vec3(0.078, 0.176, 0.212);
  vec3 col = mix(ivory, ivory2, silk);
  float tealBand = smoothstep(0.55, 0.95, fbm(p*1.1 + q*1.5 + vec2(-t, t*0.3)));
  float amberBand = smoothstep(0.62, 0.98, fbm(p*0.9 - q + vec2(t*0.5, 3.0)));
  col = mix(col, teal, tealBand * 0.16);
  col = mix(col, amber, amberBand * 0.14);
  // Dark variant for navy sections: same silk, inverted base.
  vec3 dcol = mix(navy, navy*0.78, silk);
  dcol = mix(dcol, teal, tealBand * 0.22);
  dcol = mix(dcol, amber, amberBand * 0.10);
  col = mix(col, dcol, uDark);
  // Fine grain so gradients never band.
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.012;
  o = vec4(col, 1.0);
}`;

export function ShaderBackdrop({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uDark = gl.getUniformLocation(prog, 'uDark');
    gl.uniform1f(uDark, dark ? 1 : 0);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let visible = true;
    let start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(canvas.clientWidth * dpr * 0.6);
      const h = Math.floor(canvas.clientHeight * dpr * 0.6);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const frame = () => {
      resize();
      const t = ((performance.now() - start) / 1000) % 3600;
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced && visible) raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([e]) => {
      const wasVisible = visible;
      visible = e.isIntersecting;
      if (visible && !wasVisible && !reduced) {
        start = performance.now() - ((performance.now() - start) % 3600000);
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      if (reduced) frame();
    });
    ro.observe(canvas);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [dark]);

  return <canvas ref={ref} className={`sd-shader ${className}`.trim()} aria-hidden="true" />;
}
