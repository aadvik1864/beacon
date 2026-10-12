import { createContext, useContext, useEffect, type ComponentPropsWithRef } from 'react';
import { motion, useSpring } from 'motion/react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const InteractionMotion = createContext(false);

type MagneticButtonProps = ComponentPropsWithRef<'button'> & {
  repel?: boolean;
};

export default function MagneticButton({ children, className = '', disabled, repel = false, onPointerMove, onPointerLeave, onBlur, ...props }: MagneticButtonProps) {
  const explicitReduced = useContext(InteractionMotion);
  const systemReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reduced = explicitReduced || systemReduced || !finePointer || Boolean(disabled);
  const x = useSpring(0, { stiffness: 320, damping: 25, mass: 0.4 });
  const y = useSpring(0, { stiffness: 320, damping: 25, mass: 0.4 });

  useEffect(() => { if (reduced) { x.jump(0); y.jump(0); } }, [reduced, x, y]);

  function reset() { x.set(0); y.set(0); }

  return <button {...props} disabled={disabled} className={`magnetic-button ${className}`} data-magnetic={repel ? 'repel' : 'attract'} data-motion-static={reduced || undefined}
    onPointerMove={event => {
      onPointerMove?.(event);
      if (reduced || event.pointerType === 'touch') return;
      const rect = event.currentTarget.getBoundingClientRect();
      const direction = repel ? -1 : 1;
      x.set(Math.max(-5, Math.min(5, (event.clientX - rect.left - rect.width / 2) * 0.08)) * direction);
      y.set(Math.max(-5, Math.min(5, (event.clientY - rect.top - rect.height / 2) * 0.08)) * direction);
    }}
    onPointerLeave={event => { reset(); onPointerLeave?.(event); }}
    onBlur={event => { reset(); onBlur?.(event); }}>
    <motion.span className="magnetic-content" style={{ x, y }}>{children}</motion.span>
  </button>;
}
