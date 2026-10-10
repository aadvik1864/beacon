/**
 * Adapted from React Bits CallChip, Copyright (c) 2026 David Haz.
 * Upstream: src/ts-tailwind/Micro/CallChip/CallChip.tsx
 * Revision: f586a29d6b90a9bf8027b76e978a82230160b8c6
 * License and modification notes: /THIRD_PARTY_NOTICES.md
 * No estimated progress or invented request timing is displayed.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { FileText, Check, RotateCcw } from 'lucide-react';
import { useReducedMotion } from 'motion/react';

export type CallChipStatus = 'idle' | 'running' | 'done' | 'error';
interface CallChipProps {
  name?: string;
  argument?: string;
  status?: CallChipStatus;
  reduceMotion?: boolean;
  onRetry?: () => void;
  className?: string;
  style?: CSSProperties;
}
type Glyph = 'tool' | 'check' | 'retry';
const SHAKE = [0, -1, 1, -0.66, 0.66, -0.33, 0];
const WORDS: Record<CallChipStatus, string> = { idle: 'queued', running: 'running', done: 'completed', error: 'failed' };
const glyphOf = (status: CallChipStatus): Glyph => status === 'done' ? 'check' : status === 'error' ? 'retry' : 'tool';

export default function CallChip({
  name = 'get_document',
  argument = 'leave_policy',
  status = 'idle',
  reduceMotion = false,
  onRetry,
  className = '',
  style,
}: CallChipProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const shakeAnim = useRef<Animation | null>(null);
  const mountedRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [pressed, setPressed] = useState(false);
  const systemReducedMotion = useReducedMotion();
  const reduced = reduceMotion || Boolean(systemReducedMotion);
  const currentGlyph = glyphOf(status);
  const roll = useRef<{ cur: Glyph; prev: Glyph | null }>({ cur: currentGlyph, prev: null });
  if (currentGlyph !== roll.current.cur) roll.current = { cur: currentGlyph, prev: roll.current.cur };

  useEffect(() => {
    mountedRef.current = true;
    setMounted(true);
    return () => {
      mountedRef.current = false;
      shakeAnim.current?.cancel();
    };
  }, []);

  useLayoutEffect(() => {
    shakeAnim.current?.cancel();
    if (mountedRef.current && status === 'error' && !reduced && rootRef.current?.animate) {
      shakeAnim.current = rootRef.current.animate(
        SHAKE.map(value => ({ transform: `translateX(${value * 3}px)`, easing: 'cubic-bezier(0.77,0,0.175,1)' })),
        { duration: 350, composite: 'add' },
      );
    }
  }, [status, reduced]);

  function glyphState(glyph: Glyph) {
    return glyph === roll.current.cur ? 'in' : glyph === roll.current.prev ? 'out' : undefined;
  }

  return (
    <span
      ref={rootRef}
      role="status"
      aria-busy={status === 'running' || undefined}
      data-status={status}
      data-mounted={mounted ? '' : undefined}
      data-pressed={pressed ? '' : undefined}
      data-reduced={reduced ? '' : undefined}
      className={`bits-call-chip ${className}`}
      style={style}
    >
      <span className="call-chip-wash" aria-hidden="true" />
      <span className="call-chip-glyph" aria-hidden="true">
        <span data-state={glyphState('tool')}><FileText size={15} /></span>
        <span data-state={glyphState('check')}><Check size={15} /></span>
        <span data-state={glyphState('retry')}><RotateCcw size={15} /></span>
      </span>
      <span className="call-chip-name" aria-hidden="true">{name}</span>
      <span className="call-chip-argument" aria-hidden="true">{argument}</span>
      <span className="call-chip-state" aria-hidden="true">{WORDS[status]}</span>
      {status === 'error' && onRetry && (
        <button
          type="button"
          className="call-chip-retry"
          aria-label={`Reset preview for ${name} ${argument}`}
          onClick={onRetry}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
        />
      )}
      <span className="sr-only">{name} {argument}: {WORDS[status]}</span>
    </span>
  );
}
