/**
 * Adapted from React Bits RubberSegment by David Haz.
 * Source and retained license: frontend/THIRD_PARTY_NOTICES.md.
 * Local changes: native button activation, optional unselected/custom state,
 * scoped keyboard navigation, no drag gesture, and reduced-motion controls.
 */
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export type SegmentItem = { value: string; label: ReactNode; ariaLabel?: string };

export default function RubberSegment({ items, value, onChange, label, disabled = false, reduceMotion = false, className = '' }: {
  items: SegmentItem[]; value: string | null; onChange: (value: string) => void;
  label: string; disabled?: boolean; reduceMotion?: boolean; className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  const slots = useRef<{ left: number; right: number }[]>([]);
  const index = items.findIndex(item => item.value === value);
  const current = useRef(index);
  current.current = index;
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const width = useTransform(() => Math.max(0, right.get() - left.get()));
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reduced = reduceMotion || Boolean(systemReduced);
  const itemKey = items.map(item => item.value).join('|');

  useLayoutEffect(() => {
    let alive = true;
    function measure() {
      if (!alive || !track.current) return;
      const rect = track.current.getBoundingClientRect();
      slots.current = controls.current.map(control => {
        const box = control?.getBoundingClientRect();
        return { left: box ? box.left - rect.left : 0, right: box ? box.right - rect.left : 0 };
      });
      const slot = slots.current[current.current];
      left.jump(slot?.left ?? 0);
      right.jump(slot?.right ?? 0);
    }
    measure();
    const observer = new ResizeObserver(measure);
    if (track.current) observer.observe(track.current);
    void document.fonts?.ready.then(measure);
    return () => { alive = false; observer.disconnect(); left.stop(); right.stop(); };
  }, [itemKey, left, right]);

  useEffect(() => {
    const slot = slots.current[index];
    if (!slot || reduced) {
      left.jump(slot?.left ?? 0);
      right.jump(slot?.right ?? 0);
      return;
    }
    // Stretch both edges across the journey, then let the trailing edge catch up.
    const startLeft = left.get();
    const startRight = right.get();
    const movingRight = slot.left >= startLeft;
    const leading = movingRight ? right : left;
    const trailing = movingRight ? left : right;
    const lead = animate(leading, movingRight ? slot.right : slot.left, { type: 'spring', stiffness: 440, damping: 34 });
    const trail = animate(trailing, movingRight ? [startLeft, Math.min(startLeft, slot.left), slot.left] : [startRight, Math.max(startRight, slot.right), slot.right], { duration: 0.38, times: [0, 0.22, 1], ease: [0.23, 1, 0.32, 1] });
    return () => { lead.stop(); trail.stop(); };
  }, [index, reduced, left, right]);

  return (
    <div ref={track} className={`bits-rubber-segment ${className}`} role="group" aria-label={label} data-unselected={index < 0 || undefined} data-reduced={reduced || undefined}>
      <motion.span className="rubber-segment-thumb" aria-hidden="true" style={{ left, width }} />
      {items.map((item, position) => <button key={item.value} ref={node => { controls.current[position] = node; }} type="button"
        aria-label={item.ariaLabel} aria-pressed={position === index} disabled={disabled} tabIndex={position === Math.max(0, index) ? 0 : -1}
        onClick={() => onChange(item.value)} onKeyDown={event => {
          if (disabled) return;
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
            Math.max(0, Math.min(items.length - 1, position + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)));
          onChange(items[next].value);
          controls.current[next]?.focus();
        }}>{item.label}</button>)}
    </div>
  );
}
