// Everything a store with the motion style on needs in its HTML besides the
// runtime island: the gate script and the three stylesheets (engine base,
// recipes, the builders' section rules). Rendered once by the store layout
// (and by the demo route); a store without the switch never renders it.

import { BASE_CSS } from '../css/base.css';
import { MOTION_CSS } from '../css/motion.css';
import { SECTIONS_CSS } from '../css/sections.css';
import { CxStyle } from './CxStyle';
import { JsFlag } from './JsFlag';

export function StoreMotionAssets() {
  return (
    <>
      <JsFlag />
      <CxStyle id="base" css={BASE_CSS} />
      <CxStyle id="motion" css={MOTION_CSS} />
      <CxStyle id="sections" css={SECTIONS_CSS} />
    </>
  );
}
