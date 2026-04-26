'use client';

import { useEffect, useRef } from 'react';

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    function isDark() {
      return document.documentElement.getAttribute('data-theme') !== 'light';
    }

    interface Dot {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
    }

    let dots: Dot[] = [];
    let w = 0;
    let h = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.scale(dpr, dpr);
      initDots();
    }

    function initDots() {
      const spacing = 50;
      dots = [];
      for (let x = 0; x < w + spacing; x += spacing) {
        for (let y = 0; y < h + spacing; y += spacing) {
          dots.push({
            x, y,
            baseX: x,
            baseY: y,
            vx: 0, vy: 0,
            radius: 1,
            alpha: 0.12,
          });
        }
      }
    }

    function drawAuroraGlow() {
      const dark = isDark();
      const a1 = dark ? 0.07 : 0.12;
      const a2 = dark ? 0.06 : 0.10;
      const a3 = dark ? 0.04 : 0.08;

      const blobs = [
        {
          x: w * 0.3 + Math.sin(time * 0.4) * w * 0.12,
          y: h * 0.3 + Math.cos(time * 0.3) * h * 0.08,
          r: w * 0.35,
          c1: `rgba(139, 92, 246, ${a1})`,
          c2: 'rgba(139, 92, 246, 0)',
        },
        {
          x: w * 0.7 + Math.cos(time * 0.35) * w * 0.1,
          y: h * 0.5 + Math.sin(time * 0.45) * h * 0.1,
          r: w * 0.3,
          c1: `rgba(59, 130, 246, ${a2})`,
          c2: 'rgba(59, 130, 246, 0)',
        },
        {
          x: w * 0.5 + Math.sin(time * 0.25) * w * 0.15,
          y: h * 0.8 + Math.cos(time * 0.3) * h * 0.05,
          r: w * 0.4,
          c1: `rgba(168, 85, 247, ${a3})`,
          c2: 'rgba(168, 85, 247, 0)',
        },
      ];

      for (const b of blobs) {
        const g = ctx!.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, b.c1);
        g.addColorStop(1, b.c2);
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, w, h);
      }
    }

    function drawDotGrid() {
      const dark = isDark();
      const dotColor = dark ? '148, 130, 220' : '100, 70, 180';
      const lineColor = dark ? '139, 92, 246' : '120, 80, 200';

      for (const dot of dots) {
        // Organic wave displacement
        const dx = Math.sin(time * 0.8 + dot.baseX * 0.008 + dot.baseY * 0.006) * 8;
        const dy = Math.cos(time * 0.6 + dot.baseY * 0.008 + dot.baseX * 0.004) * 8;
        dot.x = dot.baseX + dx;
        dot.y = dot.baseY + dy;

        // Distance from center for brightness
        const cx = dot.x - w / 2;
        const cy = dot.y - h / 2;
        const dist = Math.sqrt(cx * cx + cy * cy);
        const maxDist = Math.sqrt(w * w + h * h) / 2;
        const brightness = 1 - (dist / maxDist) * 0.7;

        // Pulse effect
        const pulse = Math.sin(time * 2 + dot.baseX * 0.01 + dot.baseY * 0.01) * 0.5 + 0.5;

        ctx!.beginPath();
        ctx!.arc(dot.x, dot.y, dot.radius + pulse * 0.8, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${dotColor}, ${dot.alpha * brightness * (0.6 + pulse * 0.4)})`;
        ctx!.fill();
      }

      // Draw connections between nearby dots
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i]!.x - dots[j]!.x;
          const dy = dots[i]!.y - dots[j]!.y;
          const dist = dx * dx + dy * dy;
          if (dist < 3600) { // 60px radius
            const alpha = (1 - dist / 3600) * 0.06;
            ctx!.beginPath();
            ctx!.moveTo(dots[i]!.x, dots[i]!.y);
            ctx!.lineTo(dots[j]!.x, dots[j]!.y);
            ctx!.strokeStyle = `rgba(${lineColor}, ${alpha})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }
    }

    function drawFloatingParticles() {
      const count = 30;
      for (let i = 0; i < count; i++) {
        const t2 = time * 0.5 + i * 137.508;
        const x = (w * 0.5) + Math.sin(t2 * 0.3 + i) * w * 0.4;
        const y = (h * 0.5) + Math.cos(t2 * 0.2 + i * 0.7) * h * 0.4;
        const pulse = Math.sin(time * 3 + i * 2) * 0.5 + 0.5;
        const r = 1.5 + pulse * 1.5;
        const alpha = 0.15 + pulse * 0.2;

        ctx!.beginPath();
        ctx!.arc(x, y, r, 0, Math.PI * 2);

        // Alternate between violet and blue particles
        if (i % 3 === 0) {
          ctx!.fillStyle = `rgba(139, 92, 246, ${alpha})`;
        } else if (i % 3 === 1) {
          ctx!.fillStyle = `rgba(99, 102, 241, ${alpha})`;
        } else {
          ctx!.fillStyle = `rgba(59, 130, 246, ${alpha})`;
        }
        ctx!.fill();

        // Particle glow
        if (pulse > 0.7) {
          const glow = ctx!.createRadialGradient(x, y, 0, x, y, r * 6);
          glow.addColorStop(0, `rgba(139, 92, 246, ${alpha * 0.3})`);
          glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
          ctx!.fillStyle = glow;
          ctx!.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
        }
      }
    }

    function animate() {
      ctx!.clearRect(0, 0, w, h);
      time += 0.016;

      drawAuroraGlow();
      drawDotGrid();
      drawFloatingParticles();

      animationId = requestAnimationFrame(animate);
    }

    resize();
    animate();

    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}
