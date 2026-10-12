/**
 * Adapted from React Bits ClickSpark by David Haz.
 * Source and retained license: frontend/THIRD_PARTY_NOTICES.md.
 * Local changes: demand-only animation, HiDPI canvas, bounded particles,
 * native button/keyboard activation, and system/explicit reduced-motion support.
 */
import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

type Spark = { x: number; y: number; angle: number; start: number };

export default function ClickSpark({ children, className = '', color = '#fff', reduceMotion = false }: {
  children: ReactNode; className?: string; color?: string; reduceMotion?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<Spark[]>([]);
  const frame = useRef(0);
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reduced = reduceMotion || Boolean(systemReduced);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    function resize() {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(rect.width * scale);
      element.height = Math.round(rect.height * scale);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    return () => { observer.disconnect(); cancelAnimationFrame(frame.current); sparks.current = []; };
  }, []);

  useEffect(() => {
    if (!reduced) return;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    sparks.current = [];
    // Changing the bitmap also clears any in-flight sparks without a drawing loop.
    if (canvas.current) canvas.current.width = canvas.current.width;
  }, [reduced]);

  function click(event: MouseEvent<HTMLDivElement>) {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (reduced || !button || button.disabled || !canvas.current) return;
    const element = canvas.current;
    const context = element.getContext('2d');
    if (!context) return;
    const rect = element.getBoundingClientRect();
    const box = button.getBoundingClientRect();
    const x = (event.detail === 0 ? box.left + box.width / 2 : event.clientX) - rect.left;
    const y = (event.detail === 0 ? box.top + box.height / 2 : event.clientY) - rect.top;
    const start = performance.now();
    sparks.current.push(...Array.from({ length: 6 }, (_, index) => ({ x, y, angle: Math.PI * 2 * index / 6, start })));
    sparks.current = sparks.current.slice(-30);
    if (frame.current) return;

    function draw(now: number) {
      if (!context) return;
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, element.width / scale, element.height / scale);
      sparks.current = sparks.current.filter(spark => now - spark.start < 380);
      for (const spark of sparks.current) {
        const progress = Math.max(0, (now - spark.start) / 380);
        const eased = progress * (2 - progress);
        const distance = eased * 22;
        const length = 6 * (1 - eased);
        context.strokeStyle = color;
        context.lineWidth = 1.5;
        context.globalAlpha = 1 - progress;
        context.beginPath();
        context.moveTo(spark.x + distance * Math.cos(spark.angle), spark.y + distance * Math.sin(spark.angle));
        context.lineTo(spark.x + (distance + length) * Math.cos(spark.angle), spark.y + (distance + length) * Math.sin(spark.angle));
        context.stroke();
      }
      frame.current = sparks.current.length ? requestAnimationFrame(draw) : 0;
    }
    frame.current = requestAnimationFrame(draw);
  }

  return <div className={`bits-click-spark ${className}`} onClick={click} data-reduced={reduced || undefined}>
    {children}<canvas ref={canvas} aria-hidden="true" />
  </div>;
}
