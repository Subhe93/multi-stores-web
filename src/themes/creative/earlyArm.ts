// Early arming of the scroll reveals. An inline script, rendered only for a
// store with the motion style on (primitives/StoreMotionAssets), that does
// the reveal part of engine/core.ts without waiting for React hydration or
// for the lazy engine chunks: on a real connection those arrive seconds
// after the first paint, and a visitor who scrolls in that window would meet
// sections that are not armed yet (no entrance, then a late one).
//
// What it does, as the document is parsed (one MutationObserver, passes
// batched per frame, no scroll listener):
// - every complete [data-cx-section] of the store root gets the automatic
//   treatment, the stagger expansion, the heading line groups and the states
//   exactly like engine/core.ts armReveals(): on screen or scrolled past =
//   "done" (never hidden), below = "pending" + IntersectionObserver;
// - a section the parser is still inside, or one that sits in a hidden
//   streaming container, waits for a later pass;
// - elements it armed carry data-cx-early, elements it tagged carry
//   data-cx-tagged="early".
//
// Hand-over: runtime/scan.ts calls window.__cxEarly.stop() when the engine
// starts (no further arming here), and engine/core.ts adopts each marked
// element with take(el): the state attribute is kept as it is (no second
// pass through "pending", no flash) and the core becomes the owner of the
// observer, the settle timer and the cleanup. Elements the core never
// adopts stay served by this script.
//
// The script is plain ES5-style JavaScript on purpose: it is not compiled.
// The numbers mirror engine/core.ts (reveal line 84 %, settle 3200 ms, at
// most 5 stagger steps, 0.1 s per heading line); earlyArm.test.tsx compares
// the two on the same markup.

/** Marker of an element armed by the early script (removed when the core adopts it). */
export const EARLY_ATTR = 'data-cx-early';
/** Value of data-cx-tagged on an element the early script tagged itself. */
export const EARLY_TAG = 'early';

export interface EarlyArmApi {
  /** Stops scanning and arming. Elements already armed keep their observer. */
  stop(): void;
  /** Releases one element (observer and settle timer) to the caller; its attributes stay. */
  take(el: Element): void;
}

declare global {
  interface Window {
    __cxEarly?: EarlyArmApi;
  }
}

/** The early script of this page, if it ran. */
export function earlyArm(): EarlyArmApi | undefined {
  return typeof window === 'undefined' ? undefined : window.__cxEarly;
}

export const EARLY_ARM_SCRIPT = `(function(){try{
var w=window,d=document,h=d.documentElement;
if(w.__cxEarly||!h.hasAttribute('data-cx-motion')||typeof IntersectionObserver==='undefined'||typeof MutationObserver==='undefined')return;
var MAX=5,AB='100000px',SKIP='script,style,template,[hidden],[data-cx-anchor]';
var owned=new Map(),watch=new Map(),stopped=false,frame=0,mo=null,mq=null;
var raf=w.requestAnimationFrame||function(f){return setTimeout(f,16)},caf=w.cancelAnimationFrame||clearTimeout;
function list(x){return Array.prototype.slice.call(x)}
function mk(m){var io=new IntersectionObserver(function(rs){for(var i=0;i<rs.length;i++){if(!rs[i].isIntersecting)continue;var a=watch.get(rs[i].target);if(a)a.slice().forEach(function(el){var o=owned.get(el);if(o&&o.io===io)show(el)})}},{rootMargin:m});return io}
var ioA=mk(AB+' 0px -16% 0px'),ioB=mk(AB+' 0px 0px 0px');
function unwatch(el,o){if(!o.io)return;var a=watch.get(o.w)||[],i=a.indexOf(el);if(i>-1)a.splice(i,1);if(!a.some(function(x){var p=owned.get(x);return p&&p.io===o.io})){o.io.unobserve(o.w)}if(!a.length)watch.delete(o.w);o.io=null}
function show(el){var o=owned.get(el);if(!o||!o.io)return;unwatch(el,o);el.setAttribute('data-cx-state','shown');o.t=setTimeout(function(){owned.delete(el);el.setAttribute('data-cx-state','done')},3200)}
function take(el){var o=owned.get(el);if(!o)return;unwatch(el,o);clearTimeout(o.t);owned.delete(el)}
function withSelf(s,q){var a=list(s.querySelectorAll(q));if(s.matches(q))a.unshift(s);return a}
function tag(el,k,i){if(el.hasAttribute('data-cx-reveal')||el.hasAttribute('data-cx-intro'))return;el.setAttribute('data-cx-reveal',k);el.setAttribute('data-cx-tagged','early');if(i)el.style.setProperty('--cx-i',String(i))}
function kids(el){return list(el.children).filter(function(c){return !c.matches(SKIP)})}
function auto(s){if(!s.hasAttribute('data-cx-auto')||s.querySelector('[data-cx-reveal],[data-cx-intro],[data-cx-section]'))return;
var host=s,k,n;for(n=0;n<6;n++){k=kids(host);if(k.length!==1)break;host=k[0]}
var blocks=kids(host).slice(0,12);if(!blocks.length){if(host!==s)tag(host,'rise');return}
blocks.forEach(function(b,i){var c=kids(b);if(c.length>=3&&c.every(function(x){return x.tagName===c[0].tagName}))tag(b,'stagger');else tag(b,'rise',Math.min(i,MAX))})}
function stagger(s){withSelf(s,'[data-cx-reveal="stagger"]').forEach(function(g){var it=list(g.querySelectorAll('[data-cx-item]'));if(!it.length)it=list(g.children);
it=it.filter(function(e){return !e.hasAttribute('data-cx-reveal')&&!e.hasAttribute('hidden')});var rt=NaN,n=0;
it.forEach(function(e){var t=e.getBoundingClientRect().top;if(isNaN(rt)||Math.abs(t-rt)>2){rt=t;n=0}tag(e,'rise',Math.min(n++,MAX))})})}
function lines(el){var ws=el.querySelectorAll('.cx-wi');if(ws.length<2)return;var line=-1,lt=NaN;
for(var i=0;i<ws.length;i++){var t=(ws[i].parentElement||ws[i]).offsetTop;if(isNaN(lt)||Math.abs(t-lt)>2){lt=t;line++}ws[i].style.setProperty('--cx-ld',(Math.min(line,MAX)*0.1).toFixed(2)+'s')}}
function pick(top,vh){return top+w.scrollY-Math.max(0,h.scrollHeight-vh)>vh*0.84?ioB:ioA}
function observe(el,o,io){o.io=io;var a=watch.get(o.w);if(!a){a=[];watch.set(o.w,a)}a.push(el);io.observe(o.w)}
function arm(s){auto(s);stagger(s);
var els=withSelf(s,'[data-cx-reveal]'),vh=w.innerHeight||h.clientHeight,vw=w.innerWidth||h.clientWidth;
els.forEach(function(el){var k=el.getAttribute('data-cx-reveal');if(k==='stagger'||el.hasAttribute('data-cx-state'))return;
var r=el.getBoundingClientRect(),top=r.top;el.setAttribute('data-cx-early','');
if(top<vh||(vw>0&&r.width>0&&(r.left>=vw||r.right<=0))){el.setAttribute('data-cx-state','done');return}
if(k==='words')lines(el);el.setAttribute('data-cx-state','pending');
var o={w:k==='mask'&&el.parentElement?el.parentElement:el,io:null,t:0};owned.set(el,o);observe(el,o,pick(top,vh))})}
function closed(n){if(d.readyState!=='loading')return true;for(;n&&n!==h;n=n.parentNode)if(n.nextSibling)return true;return false}
function pass(){frame=0;if(stopped)return;
owned.forEach(function(o,el){if(!el.isConnected)take(el)});
if(!h.hasAttribute('data-cx-motion'))return;
var root=d.querySelector('.store-root');if(!root||root.matches('[data-motion-reveal="off"],[data-cx-builder]'))return;
var ss=root.querySelectorAll('[data-cx-section]');for(var i=0;i<ss.length;i++){if(closed(ss[i])&&!ss[i].closest('[hidden],template'))arm(ss[i])}}
function schedule(){if(!frame&&!stopped)frame=raf(pass)}
function settle(){if(stopped)return;pass();var vh=w.innerHeight||h.clientHeight;
owned.forEach(function(o,el){if(!o.io)return;var io=pick(o.w.getBoundingClientRect().top,vh);if(io!==o.io){unwatch(el,o);observe(el,o,io)}})}
function reduced(){try{if(mq&&mq.matches&&sessionStorage.getItem('cx-motion')!=='force')h.removeAttribute('data-cx-motion')}catch(e){}}
function stop(){if(stopped)return;stopped=true;caf(frame);frame=0;if(mo)mo.disconnect();
d.removeEventListener('DOMContentLoaded',settle);w.removeEventListener('load',settle);if(mq&&mq.removeEventListener)mq.removeEventListener('change',reduced)}
w.__cxEarly={stop:stop,take:take};
mo=new MutationObserver(function(rs){for(var i=0;i<rs.length;i++){if(rs[i].addedNodes.length||rs[i].removedNodes.length){schedule();return}}});
mo.observe(h,{childList:true,subtree:true});
d.addEventListener('DOMContentLoaded',settle);w.addEventListener('load',settle);
if(w.matchMedia){mq=w.matchMedia('(prefers-reduced-motion: reduce)');if(mq.addEventListener)mq.addEventListener('change',reduced)}
schedule();
}catch(e){}})()`;
