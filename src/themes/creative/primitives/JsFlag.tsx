import { MOTION_FLAG_SCRIPT } from '../motionFlag';

/**
 * Inline script that opens the motion gate (html[data-cx-motion]) before the
 * creative markup after it paints. Rendered on the server only matters: in a
 * client render the script does not run and the islands set the flag.
 */
export function JsFlag() {
  return <script dangerouslySetInnerHTML={{ __html: MOTION_FLAG_SCRIPT }} />;
}
