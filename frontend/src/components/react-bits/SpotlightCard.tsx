/**
 * Adapted from React Bits SpotlightCard by David Haz.
 * Source and retained license: frontend/THIRD_PARTY_NOTICES.md.
 * Local changes: light surfaces, local pointer/focus events, no ambient loop,
 * and live system/explicit reduced-motion support.
 */
import { useRef, type CSSProperties, type HTMLAttributes, type PointerEvent } from 'react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & {
  spotlightColor?: string;
  spotlightSize?: number;
  reduceMotion?: boolean;
};

export default function SpotlightCard({ children, className = '', style, spotlightColor = '#2458d3', spotlightSize = 280, reduceMotion = false, ...props }: SpotlightCardProps) {
  const root = useRef<HTMLDivElement>(null);
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const reduced = reduceMotion || Boolean(systemReduced);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType === 'touch') return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--spotlight-x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--spotlight-y', `${event.clientY - rect.top}px`);
    event.currentTarget.dataset.spotlight = 'pointer';
  }

  return (
    <div {...props} ref={root} className={`bits-spotlight-card ${className}`} data-spotlight-reduced={reduced || undefined}
      style={{ '--spotlight-color': spotlightColor, '--spotlight-size': `${spotlightSize}px`, ...style } as CSSProperties}
      onPointerMove={move}
      onPointerLeave={event => { delete event.currentTarget.dataset.spotlight; }}
      onFocusCapture={event => {
        if (reduced || !(event.target instanceof HTMLElement)) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const target = event.target.getBoundingClientRect();
        event.currentTarget.style.setProperty('--spotlight-x', `${target.left + target.width / 2 - rect.left}px`);
        event.currentTarget.style.setProperty('--spotlight-y', `${target.top + target.height / 2 - rect.top}px`);
        event.currentTarget.dataset.spotlight = 'focus';
      }}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) delete event.currentTarget.dataset.spotlight; }}>
      <span className="spotlight-wash" aria-hidden="true" />
      {children}
      <span className="spotlight-edge" aria-hidden="true" />
    </div>
  );
}
