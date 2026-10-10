/**
 * Adapted from React Bits StatusMark, Copyright (c) 2026 David Haz.
 * Upstream: src/ts-tailwind/Micro/StatusMark/StatusMark.tsx
 * Revision: f586a29d6b90a9bf8027b76e978a82230160b8c6
 * License and modification notes: /THIRD_PARTY_NOTICES.md
 */
import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';

export type StatusMarkStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

interface StatusMarkProps {
  status?: StatusMarkStatus;
  progress?: number;
  label?: ReactNode;
  color?: string;
  doneColor?: string;
  errorColor?: string;
  size?: number;
  strokeWidth?: number;
  dashes?: number;
  spinDuration?: number;
  arcLength?: number;
  reduceMotion?: boolean;
  className?: string;
  style?: CSSProperties;
}

const UI = { type: 'spring' as const, duration: 0.3, bounce: 0 };
const MORPH = { duration: 0.3, ease: [0.77, 0, 0.175, 1] as [number, number, number, number] };
const CHECK = 'M7.5 12.25 10.5 15.25 16.75 8.75';
const CROSS = 'M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5';
const TEXT: Record<StatusMarkStatus, string> = {
  pending: 'Pending', running: 'In progress', done: 'Completed', failed: 'Failed', cancelled: 'Cancelled',
};
const IDLE_DASH = 0.3;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export default function StatusMark({
  status = 'pending', progress, label, color = 'currentColor',
  doneColor = '#137665', errorColor = '#B42332', size = 20,
  strokeWidth = 2, dashes = 8, spinDuration = 1100, arcLength = 0.68,
  reduceMotion = false, className = '', style,
}: StatusMarkProps) {
  const systemReducedMotion = useReducedMotion();
  const reduced = reduceMotion || Boolean(systemReducedMotion);
  const r = 10 - strokeWidth / 2;
  const C = 2 * Math.PI * r;
  const P = C / Math.max(1, dashes);
  const determinate = status === 'running' && typeof progress === 'number' && Number.isFinite(progress);
  const indeterminate = status === 'running' && !determinate;
  const solid = status === 'running' || status === 'done' || status === 'failed';
  const targetArc = indeterminate ? arcLength : determinate ? clamp01(progress as number) : 1;
  const mode = useMotionValue(solid ? 1 : 0);
  const arc = useMotionValue(targetArc);
  const travel = useMotionValue(0);
  const ringRef = useRef<SVGCircleElement>(null);
  const geo = useRef({ C, P });
  geo.current = { C, P };
  const gen = useRef(0);

  const writeDash = () => {
    const g = geo.current;
    const m = mode.get();
    const a = arc.get();
    const dash = IDLE_DASH * g.P + (a * g.C - IDLE_DASH * g.P) * m;
    const gap = (1 - IDLE_DASH) * g.P + ((1 - a) * g.C - (1 - IDLE_DASH) * g.P) * m;
    ringRef.current?.setAttribute('stroke-dasharray', `${Math.max(0, dash)} ${Math.max(0, gap)}`);
  };

  useLayoutEffect(() => {
    writeDash();
    ringRef.current?.setAttribute('stroke-dashoffset', String(travel.get()));
  }, [C, P]);

  useEffect(() => {
    const subscriptions = [
      mode.on('change', writeDash),
      arc.on('change', writeDash),
      travel.on('change', value => ringRef.current?.setAttribute('stroke-dashoffset', String(value))),
    ];
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
      mode.stop(); arc.stop(); travel.stop();
    };
  }, []);

  useEffect(() => {
    const generation = ++gen.current;
    if (reduced) {
      mode.jump(solid ? 1 : 0); arc.jump(targetArc); travel.jump(0);
      return;
    }
    if (mode.get() === 0) arc.jump(targetArc);
    const modeAnimation = animate(mode, solid ? 1 : 0, MORPH);
    const arcAnimation = animate(arc, targetArc, UI);
    const start = travel.get();
    const unit = determinate ? C : P;
    const travelAnimation = indeterminate
      ? animate(travel, [start, start - C], { duration: spinDuration / 1000, ease: 'linear', repeat: Infinity })
      : animate(travel, Math.floor(start / unit) * unit, UI);
    if (!indeterminate) {
      travelAnimation.then(() => { if (gen.current === generation) travel.jump(0); });
    }
    return () => { modeAnimation.stop(); arcAnimation.stop(); travelAnimation.stop(); };
  }, [status, determinate, targetArc, reduced, C, P, spinDuration]);

  const spoken = TEXT[status] + (determinate ? `, ${Math.round(clamp01(progress as number) * 100)}%` : '');
  const hasLabel = label !== undefined && label !== null;
  return (
    <span
      className={`bits-status-mark ${className}`}
      data-status={status}
      data-reduced={reduced ? '' : undefined}
      style={{ '--sm-color': color, '--sm-done': doneColor, '--sm-error': errorColor, ...style } as CSSProperties}
    >
      <svg
        viewBox="0 0 24 24" width={size} height={size}
        role={hasLabel ? undefined : 'img'}
        aria-label={hasLabel ? undefined : spoken}
        aria-hidden={hasLabel || undefined}
      >
        <circle className="status-mark-background" cx="12" cy="12" r={r} strokeWidth={strokeWidth} />
        <circle ref={ringRef} className="status-mark-ring" cx="12" cy="12" r={r} strokeWidth={strokeWidth} transform="rotate(-90 12 12)" />
        <path className="status-mark-check" d={CHECK} pathLength="1" strokeWidth={strokeWidth} />
        <path className="status-mark-cross" d={CROSS} pathLength="1" strokeWidth={strokeWidth} />
      </svg>
      {hasLabel && <><span className="sr-only">{spoken}: </span><span>{label}</span></>}
    </span>
  );
}
