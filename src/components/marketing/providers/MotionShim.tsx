// Inline <head> script for the marketing pages. Adds `html[data-js]` so the
// "hidden until JS" reveal styles only apply when JavaScript runs, and flips
// `prefers-reduced-motion` to "no-preference" because Windows users who turned
// off OS animations would otherwise never see any motion (Lenis and GSAP both
// read the query). Must run before Lenis is constructed, hence inline.
const SHIM = `
(function(){
  var d=document.documentElement;d.setAttribute('data-js','');
  try{
    var mm=window.matchMedia;
    window.matchMedia=function(q){
      var r=mm.call(window,q);
      if(/prefers-reduced-motion/.test(q)){
        var reduce=/reduce/.test(q);
        return {matches:!reduce,media:q,onchange:null,addListener:function(){},removeListener:function(){},addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return false}};
      }
      return r;
    };
  }catch(e){}
})();`;

export function MotionShim() {
  return <script dangerouslySetInnerHTML={{ __html: SHIM }} />;
}
