import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import App from './App';

vi.mock('./components/experiment/AccessGraph', () => ({ default: () => <div>Access diagram</div> }));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'ok', product: 'Beacon', version: '0.2.0', stage: 'local-simulation', aws_enabled: false, paid_inference_enabled: false }),
  }));
});

describe('interface scaffold', () => {
  it('brands Beacon and labels local execution without exposing AWS controls', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'Beacon home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run comparison' })).toBeInTheDocument();
    expect(screen.getByText('Live AWS requires setup, cost review, and approval')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Architecture/ }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Permissions decide.');
    expect(screen.getByText('No model or AWS requests are running.')).toBeInTheDocument();
    expect(screen.getAllByText('* Planned permissions, not observed results.')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Run comparison/ })).not.toBeInTheDocument();
  });

  it('inspects architecture without contacting a cloud endpoint', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Architecture/ }));
    fireEvent.click(screen.getByRole('button', { name: /AI assistant/ }));
    expect(screen.getByText('The model proposes an action.')).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/health');
  });

  it('shows read-only document previews', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Architecture/ }));
    fireEvent.click(screen.getByRole('button', { name: /Synthetic payroll/ }));
    expect(screen.getByText('private/payroll.csv')).toBeInTheDocument();
    expect(screen.getByText('No real employee information.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'private/payroll.csv' }));
    expect(screen.queryByText('No real employee information.')).not.toBeInTheDocument();
  });

  it('allows local component states without issuing extra requests', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Component bench/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
    expect(screen.getByRole('button', { name: /Reset preview/ })).toBeInTheDocument();
    expect(screen.getByText(/They do not run tools, contact AWS/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reset preview/ }));
    expect(screen.getByRole('button', { name: 'Queued' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('scopes arrow navigation to the component list and leaves Tab alone', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Component bench/ }));
    const list = screen.getByRole('listbox', { name: 'React Bits components' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(within(list).getByRole('option', { name: /StatusMark/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'StatusMark' })).toBeInTheDocument();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    list.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('opens and completes the accessible setup guide', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Quick guide/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'How this lab will work' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Step 3: Evidence' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Finish guide/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('supports an explicit reduced-motion preference', () => {
    render(<App />);
    const control = screen.getByRole('button', { name: /Reduce motion/ });
    fireEvent.click(control);
    expect(control).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('.app-shell')).toHaveAttribute('data-reduced-motion', 'true');
  });

  it('keeps the guide open through StrictMode effect replay', async () => {
    render(<StrictMode><App /></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: /Quick guide/ }));
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('open'));
    expect(screen.getByRole('heading', { name: 'How this lab will work' })).toBeInTheDocument();
  });

  it('shows actual local API readiness without implying AWS readiness', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Local setup/ }));
    await waitFor(() => expect(screen.getByText(/Connected · v0.2.0/)).toBeInTheDocument());
    expect(screen.getByText('AWS resources or role switching')).toBeInTheDocument();
  });
});
