// Behaviour "dawn": the live parts of "hero-dawn".
//
// 1. First-screen size: after a client-side navigation the inline size
//    script of the section never ran; measure once (and on width changes).
// 2. Living dawn light (data-cx-light="on"): one full-screen-triangle WebGL2
//    fragment shader in the sky, rendered well below device resolution (DPR
//    clamped to 1.5, then x0.55), about 30 frames a second, paused off screen
//    and in a hidden tab. Its dawn follows the CSS dawn animation (so the
//    intro, its wait gate and seeking stay in sync), its warmth follows the
//    scroll. Any failure leaves the CSS gradients in place.
// 3. Scroll layers (not under the calm profile): one scrubbed timeline over
//    the hero's pass (top top -> bottom top, scrub 1.2): the sun keeps rising
//    and grows, the ray crown turns, the warm light comes up, ridge, arch,
//    card and copy separate in depth, the cue fades, and the light ridge
//    rises by morphing between two curves. Values differ from 900 px.

import { readLightColors } from '../../sections/dawnLight';
import type { Behavior, Cleanup } from '../core';

const VS = '#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}';
const FS = [
  '#version 300 es',
  'precision highp float;',
  'uniform vec2 uRes,uSun;uniform float uR,uT,uDawn,uWarm;uniform vec3 uTop,uEmber,uHaze,uGold,uEmb;out vec4 o;',
  'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
  'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}',
  'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=mat2(1.6,1.2,-1.2,1.6)*p+3.1;a*=.5;}return v;}',
  'void main(){',
  ' vec2 px=gl_FragCoord.xy,uv=px/uRes;float t=uT;',
  ' vec2 d=(px-uSun)/max(uR*3.2,1.);float r=length(d);',
  // Night: ember near the horizon, near-black above.
  ' vec3 col=mix(uEmber,uTop,smoothstep(0.,.7,uv.y));',
  // Drifting haze, folded once (domain warp), strongest low and near the sun.
  ' vec2 q=vec2(px.x/uRes.y*1.5+t*.018,uv.y*2.6-t*.009);',
  ' float w=fbm(q+1.4*fbm(q*1.6+vec2(-t*.03,t*.012)));',
  ' float hz=smoothstep(.42,.95,w);float nr=exp(-r*1.3);',
  ' vec3 gold=uGold,emb=uEmb;',
  ' col+=uHaze*hz*(.18+.9*nr)*(1.-uv.y*.6)*uDawn;',
  // Warm glow around the sun disc.
  ' col+=gold*exp(-r*r*4.5)*.42*uDawn+emb*exp(-r*2.4)*.2*uDawn;',
  // Soft god-rays turning very slowly, mostly above the horizon, lit by the haze.
  ' float a=atan(d.x,d.y);',
  ' float ry=n(vec2(a*6.+t*.06,t*.05))*.6+n(vec2(a*15.-t*.08,3.-t*.07))*.4;',
  ' ry=smoothstep(.5,1.,ry)*exp(-r*.85)*smoothstep(.3,.62,r)*smoothstep(-.3,.3,d.y);',
  ' col+=gold*ry*.26*(.5+hz*.9)*uDawn;',
  // More ember as the page scrolls into the day.
  ' col+=emb*uWarm*.16*(1.-uv.y*.6)+gold*uWarm*.08*exp(-r*1.4);',
  ' col=min(col,vec3(.92))+(h(px+fract(t))-.5)/255.;',
  ' o=vec4(col,1.);',
  '}',
].join('\n');

const UNIFORMS = ['uRes', 'uSun', 'uR', 'uT', 'uDawn', 'uWarm', 'uTop', 'uEmber', 'uHaze', 'uGold', 'uEmb'] as const;
const DAWN_ANIMATION = 'cx-hd-dawn';
const DAWN_MS = 2800;

/** Same measurement as the inline size script of the section. */
function measure(root: HTMLElement): void {
  const rt = root.getBoundingClientRect().top + window.scrollY;
  if (rt >= 0 && rt < 260) root.style.setProperty('--cx-hd-top', `${Math.round(rt)}px`);
  const header = document.querySelector<HTMLElement>('#store-nav-header header') || document.querySelector('header');
  if (header && !root.contains(header)) {
    const hb = header.getBoundingClientRect().bottom + (getComputedStyle(header).position === 'fixed' ? 0 : window.scrollY);
    const overlap = Math.round(hb - rt);
    root.style.setProperty('--cx-hd-hdr', `${overlap > 8 && overlap < 220 ? overlap : 0}px`);
  }
}

function startLight(root: HTMLElement): Cleanup | null {
  const sky = root.querySelector<HTMLElement>('.cx-hd-sky');
  const disc = root.querySelector<HTMLElement>('[data-cx-disc]');
  const glow = root.querySelector<HTMLElement>('.cx-hd-glow');
  if (!sky || !disc || !glow || typeof WebGL2RenderingContext === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.className = 'cx-hd-gl';
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const g = gl;
  const shader = (type: number, src: string) => {
    const s = g.createShader(type);
    if (!s) return null;
    g.shaderSource(s, src);
    g.compileShader(s);
    return g.getShaderParameter(s, g.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(g.VERTEX_SHADER, VS);
  const fs = shader(g.FRAGMENT_SHADER, FS);
  const program = g.createProgram();
  if (!vs || !fs || !program) return null;
  g.attachShader(program, vs);
  g.attachShader(program, fs);
  g.linkProgram(program);
  if (!g.getProgramParameter(program, g.LINK_STATUS)) return null;
  g.useProgram(program);
  g.bindVertexArray(g.createVertexArray());
  const U = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  for (const k of UNIFORMS) U[k] = g.getUniformLocation(program, k);
  const colors = readLightColors(root.getAttribute('data-cx-light-colors'));
  (['uTop', 'uEmber', 'uHaze', 'uGold', 'uEmb'] as const).forEach((k, i) => g.uniform3f(U[k], colors[i][0], colors[i][1], colors[i][2]));

  sky.insertBefore(cv, sky.querySelector('.cx-hd-scrim'));
  root.setAttribute('data-cx-gl', '');

  // Soft content: rendered well below device resolution.
  let scale = 1;
  const resize = () => {
    scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.55;
    const w = Math.max(1, Math.round(sky.clientWidth * scale));
    const h = Math.max(1, Math.round(sky.clientHeight * scale));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
      g.viewport(0, 0, w, h);
    }
  };
  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(sky);
  else window.addEventListener('resize', resize);

  const t0 = performance.now();
  let last = 0;
  let raf = 0;
  let visible = !document.hidden;
  let onScreen = true;
  let shown = false;
  let dead = false;

  // Follows the CSS dawn animation of the glow layer (eased like it).
  const dawn = () => {
    const list = typeof glow.getAnimations === 'function' ? glow.getAnimations() : [];
    for (const an of list) {
      if ((an as CSSAnimation).animationName === DAWN_ANIMATION) {
        const p = Math.min(1, Math.max(0, Number(an.currentTime || 0) / DAWN_MS));
        return 1 - Math.pow(1 - p, 3);
      }
    }
    return 1;
  };
  const frame = (now: number) => {
    raf = 0;
    if (dead || !visible || !onScreen) return;
    raf = requestAnimationFrame(frame);
    if (now - last < 32) return;
    last = now;
    const sr = sky.getBoundingClientRect();
    const dr = disc.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    g.uniform2f(U.uRes, cv.width, cv.height);
    g.uniform2f(U.uSun, (dr.left + dr.width / 2 - sr.left) * scale, (sr.bottom - (dr.top + dr.height / 2)) * scale);
    g.uniform1f(U.uR, dr.width * 0.279 * scale);
    g.uniform1f(U.uT, ((now - t0) / 1000) % 3600);
    g.uniform1f(U.uDawn, dawn());
    g.uniform1f(U.uWarm, Math.min(1, Math.max(0, -rr.top / Math.max(1, rr.height))));
    g.drawArrays(g.TRIANGLES, 0, 3);
    if (!shown) {
      shown = true;
      requestAnimationFrame(() => cv.setAttribute('data-on', ''));
    }
  };
  const kick = () => {
    if (!raf && !dead && visible && onScreen) raf = requestAnimationFrame(frame);
  };
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((records) => {
          onScreen = records[records.length - 1].isIntersecting;
          kick();
        })
      : null;
  io?.observe(root);
  const onVisibility = () => {
    visible = !document.hidden;
    kick();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const stop = () => {
    dead = true;
    cancelAnimationFrame(raf);
    raf = 0;
    root.removeAttribute('data-cx-gl');
    cv.remove();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    stop();
  };
  cv.addEventListener('webglcontextlost', onLost);
  kick();

  return () => {
    stop();
    io?.disconnect();
    if (ro) ro.disconnect();
    else window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    cv.removeEventListener('webglcontextlost', onLost);
    g.getExtension('WEBGL_lose_context')?.loseContext();
  };
}

const dawn: Behavior = async (el, ctx) => {
  const cleanups: Cleanup[] = [];
  const done = () => {
    for (const c of cleanups.reverse()) c();
  };

  // 1. Size (only when the inline script did not run).
  if (!el.style.getPropertyValue('--cx-hd-top')) {
    measure(el);
    let lastW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      measure(el);
    };
    window.addEventListener('resize', onResize);
    cleanups.push(() => window.removeEventListener('resize', onResize));
  }

  // 2. Light.
  if (el.getAttribute('data-cx-light') === 'on') {
    try {
      const stopLight = startLight(el);
      if (stopLight) cleanups.push(stopLight);
    } catch {
      // The CSS sky stays.
    }
  }

  // 3. Scroll layers.
  if (ctx.calm) return done;
  const { gsap } = await ctx.loadGsap();
  if (!el.isConnected) return done;
  const q = (s: string) => el.querySelector<HTMLElement | SVGElement>(s);
  const rtl = ctx.rtl ? -1 : 1;
  const day = q('[data-rise]');
  const context = gsap.context(() => {
    const mm = gsap.matchMedia();
    mm.add({ desk: '(min-width: 900px)', phone: '(max-width: 899px)' }, (c) => {
      const d = !!c.conditions?.desk;
      const H = () => el.offsetHeight;
      // From "hero top at the viewport top" to "hero bottom at the viewport
      // top", as absolute scroll positions measured on every refresh.
      const top = () => el.getBoundingClientRect().top + window.scrollY;
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: el,
          start: () => top(),
          end: () => top() + el.offsetHeight,
          scrub: 1.2,
          invalidateOnRefresh: true,
        },
      });
      const add = (selector: string, vars: gsap.TweenVars) => {
        const target = q(selector);
        if (target) tl.to(target, vars, 0);
      };
      // Depth: sun (far, keeps rising) < ridge < arch < card < copy (near).
      add('.cx-hd-sunpar', { yPercent: d ? -20 : -12, scale: 1.06 });
      add('.cx-hd-raysturn', { rotation: 22 * rtl });
      add('.cx-hd-warm', { opacity: 1 });
      add('.cx-hd-ridgepar', { y: () => H() * (d ? 0.07 : 0.04) });
      add('.cx-hd-archpar', { y: () => -H() * (d ? 0.12 : 0.06) });
      add('.cx-hd-archzoom', { scale: 1.08 });
      add('.cx-hd-cardpar', { y: () => -H() * (d ? 0.3 : 0.14) });
      add('.cx-hd-copy', { y: () => -H() * (d ? 0.16 : 0.05), opacity: d ? 0 : 0.35 });
      add('.cx-hd-cue', { opacity: 0, duration: 0.12 });
      // The light foothills rise by morphing between two smooth curves of the
      // same structure, so the ridge never stretches into spikes.
      const rise = day?.getAttribute('data-rise');
      if (day && rise) tl.to(day, { attr: { d: rise } }, 0);
    });
  }, el);
  cleanups.push(() => context.revert());
  return done;
};

export default dawn;
