import { EARLY_ARM_SCRIPT } from '../earlyArm';

/**
 * Inline script that arms the scroll reveals while the document is parsed
 * (see ../earlyArm.ts). Rendered after the gate script and only by
 * StoreMotionAssets: a store without the motion style never gets it.
 */
export function EarlyArm() {
  return <script data-cx-early-script="" dangerouslySetInnerHTML={{ __html: EARLY_ARM_SCRIPT }} />;
}
