import type { HTMLAttributes } from 'react';
import type { HeadingTag } from './headingLevel';

/**
 * A heading whose element comes from the builder's heading level. Defined at
 * module level so sections don't create a component during render.
 */
export function Heading({ level, ...props }: { level: HeadingTag } & HTMLAttributes<HTMLHeadingElement>) {
  const Tag = level;
  return <Tag {...props} />;
}
