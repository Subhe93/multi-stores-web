'use client';

import { useEffect, useRef, ReactNode } from 'react';

type AnimationType =
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'flip-up'
  | 'blur-in'
  | 'slide-rotate'
  | 'stagger';

interface RevealProps {
  children: ReactNode;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  threshold?: number;
  className?: string;
  once?: boolean;
}

export function Reveal({
  children,
  animation = 'fade-up',
  delay = 0,
  duration = 800,
  threshold = 0.15,
  className = '',
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Set initial hidden state
    el.style.opacity = '0';
    el.style.transition = `all ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`;
    applyInitialTransform(el, animation);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          // Reveal
          el.style.opacity = '1';
          el.style.transform = 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
          el.style.filter = 'blur(0px)';
          if (once) observer.unobserve(el);
        } else if (!once) {
          // Hide again when scrolling away
          el.style.opacity = '0';
          applyInitialTransform(el, animation);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animation, delay, duration, threshold, once]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

function applyInitialTransform(el: HTMLElement, animation: AnimationType) {
  switch (animation) {
    case 'fade-up':
      el.style.transform = 'translate3d(0, 60px, 0)';
      break;
    case 'fade-down':
      el.style.transform = 'translate3d(0, -60px, 0)';
      break;
    case 'fade-left':
      el.style.transform = 'translate3d(-80px, 0, 0)';
      break;
    case 'fade-right':
      el.style.transform = 'translate3d(80px, 0, 0)';
      break;
    case 'zoom-in':
      el.style.transform = 'scale(0.8)';
      break;
    case 'zoom-out':
      el.style.transform = 'scale(1.15)';
      break;
    case 'flip-up':
      el.style.transform = 'perspective(1000px) rotateX(15deg) translateY(40px)';
      break;
    case 'blur-in':
      el.style.filter = 'blur(12px)';
      el.style.transform = 'scale(0.95)';
      break;
    case 'slide-rotate':
      el.style.transform = 'translate3d(-40px, 40px, 0) rotate(-3deg)';
      break;
    case 'stagger':
      el.style.transform = 'translate3d(0, 40px, 0)';
      break;
  }
}

// Staggered children animation
interface StaggerProps {
  children: ReactNode[];
  staggerDelay?: number;
  animation?: AnimationType;
  duration?: number;
  className?: string;
  childClassName?: string;
}

export function Stagger({
  children,
  staggerDelay = 120,
  animation = 'fade-up',
  duration = 700,
  className = '',
  childClassName = '',
}: StaggerProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <Reveal
          key={i}
          animation={animation}
          delay={i * staggerDelay}
          duration={duration}
          className={childClassName}
        >
          {child}
        </Reveal>
      ))}
    </div>
  );
}

// Parallax scroll effect
interface ParallaxProps {
  children: ReactNode;
  speed?: number;
  className?: string;
}

export function Parallax({ children, speed = 0.3, className = '' }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let ticking = false;

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          const rect = el!.getBoundingClientRect();
          const centerY = rect.top + rect.height / 2;
          const viewportCenter = window.innerHeight / 2;
          const offset = (centerY - viewportCenter) * speed;
          el!.style.transform = `translateY(${offset}px)`;
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [speed]);

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}

// Counter animation
interface CountUpProps {
  end: number;
  suffix?: string;
  duration?: number;
  className?: string;
}

export function CountUp({ end, suffix = '', duration = 2000, className = '' }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = 0;
          const startTime = performance.now();

          function animate(now: number) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (end - start) * eased);
            el!.textContent = `${current}${suffix}`;

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          }

          requestAnimationFrame(animate);
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [end, suffix, duration]);

  return <span ref={ref} className={className}>0{suffix}</span>;
}

// Magnetic hover effect for buttons/cards
interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

export function Magnetic({ children, strength = 0.3, className = '' }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      el!.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      el!.style.transition = 'transform 0.2s ease-out';
    }

    function onLeave() {
      el!.style.transform = 'translate(0, 0)';
      el!.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [strength]);

  return (
    <div ref={ref} className={className} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}

// Text reveal animation - letter by letter
interface TextRevealProps {
  text: string;
  className?: string;
  delay?: number;
  letterDelay?: number;
}

export function TextReveal({ text, className = '', delay = 0, letterDelay = 30 }: TextRevealProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const spans = el.querySelectorAll<HTMLSpanElement>('span[data-letter]');
    spans.forEach((span) => {
      span.style.opacity = '0';
      span.style.transform = 'translateY(20px)';
      span.style.display = 'inline-block';
      span.style.transition = 'none';
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          spans.forEach((span, i) => {
            setTimeout(() => {
              span.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
              span.style.opacity = '1';
              span.style.transform = 'translateY(0)';
            }, delay + i * letterDelay);
          });
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, letterDelay]);

  return (
    <span ref={ref} className={className}>
      {text.split('').map((char, i) => (
        <span key={i} data-letter>
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}
