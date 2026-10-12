import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RubberSegment from './RubberSegment';
import SpotlightCard from './SpotlightCard';
import ClickSpark from './ClickSpark';
import PermissionPreview from '../experiment/PermissionPreview';
import MagneticButton, { InteractionMotion } from './MagneticButton';

const items = [{ value: 'clean', label: 'Clean' }, { value: 'attack', label: 'Attack example' }];

describe('React Bits interactions', () => {
  it('uses native button activation for the document selector', () => {
    const change = vi.fn();
    render(<RubberSegment label="Templates" items={items} value="clean" onChange={change} reduceMotion />);
    fireEvent.click(screen.getByRole('button', { name: 'Attack example' }));
    expect(change).toHaveBeenCalledWith('attack');
    expect(screen.getByRole('button', { name: 'Clean' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('supports scoped arrow/Home/End navigation without intercepting Tab', () => {
    const change = vi.fn();
    render(<RubberSegment label="Templates" items={items} value="clean" onChange={change} reduceMotion />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Clean' }), { key: 'End' });
    expect(change).toHaveBeenLastCalledWith('attack');
    expect(screen.getByRole('button', { name: 'Attack example' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Attack example' }), { key: 'ArrowLeft' });
    expect(change).toHaveBeenLastCalledWith('clean');
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    screen.getByRole('button', { name: 'Clean' }).dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('does not label a custom document as a selected template', () => {
    render(<RubberSegment label="Templates" items={items} value={null} onChange={vi.fn()} reduceMotion />);
    expect(screen.getByRole('group')).toHaveAttribute('data-unselected');
    for (const button of screen.getAllByRole('button')) expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Clean' })).toHaveAttribute('tabindex', '0');
  });

  it('does not change a disabled selector', () => {
    const change = vi.fn();
    render(<RubberSegment label="Templates" items={items} value="clean" onChange={change} disabled reduceMotion />);
    const button = screen.getByRole('button', { name: 'Attack example' });
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: 'Home' });
    expect(change).not.toHaveBeenCalled();
  });

  it('makes the preview interactive without running an experiment', () => {
    render(<PermissionPreview busy={false} reduceMotion />);
    expect(screen.getByText('Only the version with too much access can read payroll.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview leave policy access' }));
    expect(screen.getByText('Both versions can read the leave policy.')).toBeInTheDocument();
    expect(screen.getAllByText('Can read this file')).toHaveLength(2);
    expect(screen.queryByText('Private file blocked')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('illustration, not a result');
  });

  it('turns spotlight tracking off for reduced motion', () => {
    const { container } = render(<SpotlightCard reduceMotion><button>Focus me</button></SpotlightCard>);
    const card = container.firstElementChild!;
    fireEvent.pointerMove(card, { clientX: 60, clientY: 40, pointerType: 'mouse' });
    fireEvent.focus(screen.getByRole('button'));
    expect(card).toHaveAttribute('data-spotlight-reduced');
    expect(card).not.toHaveAttribute('data-spotlight');
  });

  it('provides a focus equivalent for spotlight cards without adding controls', () => {
    const { container } = render(<SpotlightCard><button>Focus me</button></SpotlightCard>);
    fireEvent.focus(screen.getByRole('button'));
    expect(container.firstElementChild).toHaveAttribute('data-spotlight', 'focus');
    expect(within(container).getAllByRole('button')).toHaveLength(1);
    fireEvent.blur(screen.getByRole('button'));
    expect(container.firstElementChild).not.toHaveAttribute('data-spotlight');
  });

  it('keeps reduced-motion spark feedback inert and does not consume button clicks', () => {
    const click = vi.fn();
    const { container } = render(<ClickSpark reduceMotion><button onClick={click}>Run</button></ClickSpark>);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(click).toHaveBeenCalledOnce();
    expect(container.firstElementChild).toHaveAttribute('data-reduced');
    expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps magnetic controls native and static for reduced motion and coarse pointers', () => {
    const click = vi.fn();
    render(<InteractionMotion.Provider value><MagneticButton onClick={click}>Attract</MagneticButton><MagneticButton repel disabled>Repel</MagneticButton></InteractionMotion.Provider>);
    const button = screen.getByRole('button', { name: 'Attract' });
    fireEvent.pointerMove(button, { clientX: 70, clientY: 40, pointerType: 'mouse' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('data-motion-static', 'true');
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Repel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Repel' })).toHaveAttribute('data-magnetic', 'repel');
  });
});
