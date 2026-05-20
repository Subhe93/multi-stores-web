'use client';

// Staggered reveal for lists/grids: children animate in one after another as
// the group scrolls into view. Wrap the grid in <StaggerGroup> and each cell in
// <StaggerItem>. SSR-safe (deterministic markup + initial style); reduced motion
// is handled globally by <MotionProvider> (MotionConfig reducedMotion="user").

import { motion, type Variants } from 'framer-motion';
import type { CSSProperties, ReactNode } from 'react';

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

interface StaggerGroupProps {
  children: ReactNode;
  /** Delay between each child's entrance, in seconds. */
  step?: number;
  className?: string;
  style?: CSSProperties;
}

export function StaggerGroup({ children, step = 0.08, className, style }: StaggerGroupProps) {
  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: step } },
  };

  return (
    <motion.div
      className={className}
      style={style}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -6% 0px', amount: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function StaggerItem({ children, className, style }: StaggerItemProps) {
  return (
    <motion.div className={className} style={style} variants={itemVariants}>
      {children}
    </motion.div>
  );
}
