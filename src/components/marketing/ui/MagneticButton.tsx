'use client';

import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP, isFinePointer } from '@/lib/animations';

interface Props {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'inverse';
  className?: string;
  external?: boolean;
}

const VARIANT: Record<NonNullable<Props['variant']>, string> = {
  primary: 'sd-btn sd-btn-primary',
  secondary: 'sd-btn sd-btn-secondary',
  ghost: 'sd-btn sd-btn-ghost',
  inverse: 'sd-btn sd-btn-inverse',
};

/** Pill button that leans toward the pointer on fine-pointer devices. */
export function MagneticButton({ href, children, variant = 'primary', className = '', external }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const strength = 0.18;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !isFinePointer()) return;
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      };
      const leave = () => {
        xTo(0);
        yTo(0);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      };
    },
    { scope: ref },
  );

  const cls = `${VARIANT[variant]} ${className}`.trim();
  if (external || href.startsWith('#') || href.startsWith('mailto:')) {
    return (
      <a ref={ref} href={href} className={cls} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        <span className="sd-btn-label">{children}</span>
      </a>
    );
  }
  return (
    <Link ref={ref} href={href} className={cls}>
      <span className="sd-btn-label">{children}</span>
    </Link>
  );
}
