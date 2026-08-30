import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  shape: number;
}

const PALETTE = ['#7C5CFF', '#FFC44D', '#34D399', '#FB7185', '#60A5FA', '#F472B6'];

/** Лёгкое конфетти на canvas — без библиотек и картинок. */
export function Confetti({ count = 120, duration = 4200 }: { count?: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = canvas.offsetWidth * dpr);
    const h = (canvas.height = canvas.offsetHeight * dpr);

    const parts: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: -Math.random() * h * 0.5,
      vx: (Math.random() - 0.5) * 1.6 * dpr,
      vy: (1.4 + Math.random() * 2.6) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.22,
      size: (5 + Math.random() * 7) * dpr,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      shape: Math.random() < 0.4 ? 1 : 0,
    }));

    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      const fade = Math.max(0, 1 - Math.max(0, elapsed - duration * 0.65) / (duration * 0.35));
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = fade;
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.012 * dpr;
        p.rot += p.vr;
        if (p.y > h + 20) {
          p.y = -20;
          p.x = Math.random() * w;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.42, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.62);
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      if (elapsed < duration) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [count, duration]);

  return <canvas ref={ref} className="confetti" aria-hidden />;
}
