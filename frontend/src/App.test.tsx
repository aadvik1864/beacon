import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import App from './App';

vi.mock('./components/experiment/AccessGraph', () => ({ default: () => <div>Access diagram</div> }));

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ status: 'ok', product: 'Beacon', version: '0.2.0', stage: 'local-simulation', aws_enabled: false, paid_inference_enabled: false }),
  }));
});

function openMore() { fireEvent.click(screen.getByText('More', { exact: true })); }

describe('Beacon interface', () => {
  it('brands Beacon and labels local execution without exposing AWS controls', () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'Beacon home' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run comparison' })).toBeInTheDocument();
    expect(screen.getByText('Scripted answers and fictional data. No live AI model or AWS calls.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'How it works' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('How it works');
    fireEvent.click(screen.getByText('Where AWS fits in a future version'));
    expect(screen.getByText('Planned AWS setup. No resources are deployed.')).toBeInTheDocument();
    expect(screen.getByText('Illustration only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Run comparison/ })).not.toBeInTheDocument();
  });

  it('inspects architecture without contacting a cloud endpoint', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'How it works' }));
    fireEvent.click(screen.getByRole('button', { name: /Add a misleading instruction/ }));
    expect(screen.getByText(/Treating that text as an instruction instead of information is called prompt injection/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Where AWS fits in a future version'));
    fireEvent.click(screen.getByRole('button', { name: 'AI assistant' }));
    expect(screen.getByText(/It would not hold AWS credentials or fetch files directly/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Too much access role' }));
    expect(screen.getByText(/No other buckets, permission changes, or role switching/)).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/health');
  });

  it('shows read-only document previews', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'How it works' }));
    fireEvent.click(screen.getByRole('button', { name: /Fictional payroll/ }));
    expect(screen.getByText('private/payroll.csv')).toBeInTheDocument();
    expect(screen.getByText('No real employee information.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'private/payroll.csv' }));
    expect(screen.queryByText('No real employee information.')).not.toBeInTheDocument();
  });

  it('allows local component states without issuing extra requests', async () => {
    render(<App />);
    openMore();
    fireEvent.click(screen.getByRole('button', { name: 'Interaction studio' }));
    fireEvent.click(screen.getByRole('button', { name: 'Failed' }));
    expect(screen.getByRole('button', { name: /Reset preview/ })).toBeInTheDocument();
    expect(screen.getByText('Visual previews only. No tools or AWS calls.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reset preview/ }));
    expect(screen.getByRole('button', { name: 'Queued' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('scopes arrow navigation to the component list and leaves Tab alone', () => {
    render(<App />);
    openMore();
    fireEvent.click(screen.getByRole('button', { name: 'Interaction studio' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Walkthrough' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'A quick walkthrough' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Step 3: Try it' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /Finish guide/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('supports an explicit reduced-motion preference', () => {
    render(<App />);
    openMore();
    const control = screen.getByRole('button', { name: /Reduce motion/ });
    fireEvent.click(control);
    expect(control).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('.app-shell')).toHaveAttribute('data-reduced-motion', 'true');
  });

  it('keeps the guide open through StrictMode effect replay', async () => {
    render(<StrictMode><App /></StrictMode>);
    fireEvent.click(screen.getByRole('button', { name: 'Walkthrough' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('open'));
    expect(screen.getByRole('heading', { name: 'A quick walkthrough' })).toBeInTheDocument();
  });

  it('shows actual local API readiness without implying AWS readiness', async () => {
    render(<App />);
    openMore();
    fireEvent.click(screen.getByRole('button', { name: 'Run locally' }));
    await waitFor(() => expect(screen.getByText('Connected (v0.2.0)')).toBeInTheDocument());
    expect(screen.getByText('Runs on your machine. AWS and paid inference are disabled.')).toBeInTheDocument();
  });

  it('keeps optional tools out of the default workspace', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Learn why AI needs access limits.');
    expect(screen.getByRole('status')).toHaveTextContent('No results yet');
    expect(document.querySelector('.advanced-options')).not.toHaveAttribute('open');
    expect(document.querySelector('.nav-more')).not.toHaveAttribute('open');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText('Access diagram')).not.toBeInTheDocument();
    expect(document.querySelector('.sidebar')).toBeNull();
    expect(document.body.textContent).not.toMatch(/[—–]/);
  });

  it('reveals simulation options without changing defaults or making requests', async () => {
    render(<App />);
    fireEvent.click(screen.getByText('Options', { exact: true }));
    expect(screen.getByLabelText('What the demo does')).toHaveValue('follow');
    expect(screen.getByLabelText('Versions to compare')).toHaveValue('both');
    fireEvent.change(screen.getByLabelText('Versions to compare'), { target: { value: 'protected' } });
    expect(screen.getByRole('button', { name: 'Run limited access' })).toBeInTheDocument();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('prepares a walkthrough example without submitting it', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Show me an example' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add a hidden instruction' }));
    expect(within(dialog).getByText(/Following a document’s instructions/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Step 3: Try it' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this example' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect((screen.getByLabelText(/policies\/leave-policy.txt/) as HTMLTextAreaElement).value).toContain('SECURITY TEST INSTRUCTION');
    expect(screen.getByRole('status')).toHaveTextContent('No results yet');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });

  it('restores the selected page from a direct link and browser navigation', () => {
    window.history.replaceState(null, '', '/#how-it-works');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('How it works');
    fireEvent.click(screen.getByRole('button', { name: 'Try it' }));
    expect(window.location.hash).toBe('#lab');
    window.history.replaceState(null, '', '/#how-it-works');
    fireEvent(window, new PopStateEvent('popstate'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('How it works');
    expect(document.title).toBe('How it works | Beacon');
  });

  it('toggles and persists the theme without making extra requests', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('beacon.theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(localStorage.getItem('beacon.theme')).toBe('light');
    openMore();
    fireEvent.click(screen.getByRole('button', { name: 'Use device theme' }));
    expect(localStorage.getItem('beacon.theme')).toBe('system');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
