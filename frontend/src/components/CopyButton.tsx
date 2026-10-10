import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyButton({ text, label = 'Copy command' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const timeout = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timeout.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('unavailable');
    }
    window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => setState('idle'), 2500);
  }
  return (
    <button className="copy-button" type="button" aria-label={label} onClick={() => void copy()}>
      {state === 'copied' ? <Check size={14} /> : <Copy size={14} />}
      <span role="status">{state === 'copied' ? 'Copied' : state === 'unavailable' ? 'Select text to copy' : 'Copy'}</span>
    </button>
  );
}
