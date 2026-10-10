/**
 * Adapted from React Bits AnimatedList, Copyright (c) 2026 David Haz.
 * Upstream: src/ts-tailwind/Components/AnimatedList/AnimatedList.tsx
 * Revision: f586a29d6b90a9bf8027b76e978a82230160b8c6
 * License and modification notes: /THIRD_PARTY_NOTICES.md
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';

interface AnimatedListProps {
  items: string[];
  onItemSelect?: (item: string, index: number) => void;
  selectedIndex?: number;
  initialSelectedIndex?: number;
  className?: string;
  label?: string;
  reduceMotion?: boolean;
  renderItem?: (item: string, index: number, selected: boolean) => ReactNode;
}

export default function AnimatedList({
  items,
  onItemSelect,
  selectedIndex: controlledIndex,
  initialSelectedIndex = 0,
  className = '',
  label = 'Select an item',
  reduceMotion = false,
  renderItem,
}: AnimatedListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const [internalIndex, setInternalIndex] = useState(initialSelectedIndex);
  const selectedIndex = controlledIndex ?? internalIndex;
  const systemReducedMotion = useReducedMotion();
  const reduced = reduceMotion || Boolean(systemReducedMotion);

  function select(index: number) {
    if (index < 0 || index >= items.length) return;
    setInternalIndex(index);
    onItemSelect?.(items[index], index);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    let next: number;
    switch (event.key) {
      case 'ArrowDown': next = Math.min(selectedIndex + 1, items.length - 1); break;
      case 'ArrowUp': next = Math.max(selectedIndex - 1, 0); break;
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
      default: return; // In particular, never trap Tab outside or inside the list.
    }
    event.preventDefault();
    select(next);
    const item = listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`);
    item?.scrollIntoView?.({ block: 'nearest', behavior: reduced ? 'instant' : 'smooth' });
  }

  return (
    <div
      ref={listRef}
      className={`bits-animated-list ${className}`}
      role="listbox"
      aria-label={label}
      aria-activedescendant={items.length && selectedIndex >= 0 && selectedIndex < items.length ? `${id}-${selectedIndex}` : undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) => (
        <AnimatedItem key={item} index={index} reduced={reduced}>
          <button
            id={`${id}-${index}`}
            role="option"
            aria-selected={selectedIndex === index}
            tabIndex={-1}
            className="animated-list-option"
            onClick={() => select(index)}
          >
            {renderItem ? renderItem(item, index, selectedIndex === index) : item}
          </button>
        </AnimatedItem>
      ))}
    </div>
  );
}

function AnimatedItem({ children, index, reduced }: { children: ReactNode; index: number; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2, once: true });
  return (
    <motion.div
      ref={ref}
      data-index={index}
      initial={reduced ? false : { y: 6, opacity: 0 }}
      animate={reduced || inView ? { y: 0, opacity: 1 } : { y: 6, opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.18, delay: reduced ? 0 : index * 0.035 }}
    >
      {children}
    </motion.div>
  );
}
