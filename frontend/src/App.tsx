import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { MotionConfig } from 'motion/react';
import { ChevronDown, Menu, Moon, RadioTower, Sun, X } from 'lucide-react';
import { useApiHealth } from './hooks/useApiHealth';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useExperiment } from './hooks/useExperiment';
import { useTheme } from './hooks/useTheme';
import { CLEAN_POLICY, INJECTED_POLICY, NORMAL_QUESTION } from './lib/experiment';
import { isBrowserDemo } from './lib/executionMode';
import Playground from './components/experiment/Playground';
import SetupGuide from './components/SetupGuide';
import HowItWorks from './components/HowItWorks';
import InteractionStudio from './components/InteractionStudio';
import LocalSetup from './components/LocalSetup';
import MagneticButton, { InteractionMotion } from './components/react-bits/MagneticButton';

type Page = 'playground' | 'workbench' | 'components' | 'setup';
const navigation = [
  { id: 'playground' as const, label: 'Try it', hash: '#lab', title: 'Beacon | An interactive AI safety lab' },
  { id: 'workbench' as const, label: 'How it works', hash: '#how-it-works', title: 'How it works | Beacon' },
  { id: 'components' as const, label: 'Interaction studio', hash: '#interactions', title: 'Interaction studio | Beacon' },
  { id: 'setup' as const, label: 'Run locally', hash: '#setup', title: 'Run locally | Beacon' },
];

export default function App() {
  const [page, setPage] = useState<Page>(() => navigation.find(item => item.hash === window.location.hash)?.id ?? 'playground');
  const [guideOpen, setGuideOpen] = useState(false);
  const [exampleVersion, setExampleVersion] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const mobile = useMediaQuery('(max-width: 800px)');
  const systemReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const motionReduced = reduceMotion || systemReducedMotion;
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeNavButton = useRef<HTMLButtonElement>(null);
  const navDialog = useRef<HTMLElement>(null);
  const main = useRef<HTMLElement>(null);
  const moreMenu = useRef<HTMLDetailsElement>(null);
  const moreTrigger = useRef<HTMLElement>(null);
  const guideTrigger = useRef<HTMLElement | null>(null);
  const exampleApplied = useRef(false);
  const api = useApiHealth(!isBrowserDemo);
  const experiment = useExperiment();
  const appearance = useTheme();

  useEffect(() => {
    document.title = navigation.find(item => item.id === page)!.title;
  }, [page]);

  useEffect(() => {
    const restore = () => {
      const next = navigation.find(item => item.hash === window.location.hash);
      if (next || !window.location.hash) { setPage(next?.id ?? 'playground'); setMobileNavOpen(false); }
    };
    const onRestore = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    window.addEventListener('pageshow', onRestore);
    return () => {
      window.removeEventListener('hashchange', restore);
      window.removeEventListener('popstate', restore);
      window.removeEventListener('pageshow', onRestore);
    };
  }, []);

  useEffect(() => {
    if (!mobile || !mobileNavOpen) return;
    closeNavButton.current?.focus();
    const dismiss = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileNavOpen(false); };
    window.addEventListener('keydown', dismiss);
    return () => { window.removeEventListener('keydown', dismiss); menuButton.current?.focus(); };
  }, [mobile, mobileNavOpen]);

  useEffect(() => { if (!mobile) setMobileNavOpen(false); }, [mobile]);

  function navigate(next: Page) {
    experiment.selectEvent(experiment.cursor);
    setPage(next);
    setMobileNavOpen(false);
    if (moreMenu.current) moreMenu.current.open = false;
    const hash = navigation.find(item => item.id === next)!.hash;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    requestAnimationFrame(() => main.current?.focus());
  }

  function openGuide() {
    guideTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    exampleApplied.current = false;
    setMobileNavOpen(false);
    if (moreMenu.current) moreMenu.current.open = false;
    setGuideOpen(true);
  }

  function useExample(attack: boolean) {
    if (experiment.busy) return;
    experiment.setPolicy(attack ? INJECTED_POLICY : CLEAN_POLICY);
    experiment.setQuestion(NORMAL_QUESTION);
    experiment.setBehavior('follow');
    setExampleVersion(value => value + 1);
    exampleApplied.current = true;
    navigate('playground');
  }

  function closeGuide() {
    setGuideOpen(false);
    requestAnimationFrame(() => {
      if (exampleApplied.current) document.getElementById('policy-editor')?.focus();
      else if (guideTrigger.current?.isConnected && !guideTrigger.current.closest('[inert]')) guideTrigger.current.focus();
      else (mobile ? menuButton.current : moreTrigger.current)?.focus();
    });
  }

  function containNavFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const controls = Array.from(navDialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  const settings = <>
    {navigation.slice(2).map(({ id, label }) => <MagneticButton key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>{label}</MagneticButton>)}
    {mobile && <MagneticButton onClick={openGuide}>Walkthrough</MagneticButton>}
    <MagneticButton onClick={() => appearance.chooseTheme('system')} disabled={appearance.preference === 'system'}>Use device theme</MagneticButton>
    {api.health?.access_mode === 'sso' && <MagneticButton onClick={() => window.location.replace('/oauth2/sign_out')}>Sign out</MagneticButton>}
    <MagneticButton aria-label={reduceMotion ? 'Restore system motion preference' : 'Reduce motion'} aria-pressed={reduceMotion} onClick={() => setReduceMotion(!reduceMotion)}>{reduceMotion ? 'Use system motion' : 'Reduce motion'}</MagneticButton>
  </>;

  return <MotionConfig reducedMotion={motionReduced ? 'always' : 'user'}><InteractionMotion.Provider value={motionReduced}>
    <div className="app-shell" data-reduced-motion={motionReduced ? 'true' : undefined}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header" inert={mobile && mobileNavOpen}>
        <a className="brand" href="#lab" onClick={event => { event.preventDefault(); navigate('playground'); }} aria-label="Beacon home"><span className="brand-mark"><RadioTower size={22} strokeWidth={1.7} /></span><span>Beacon</span></a>
        <nav className="primary-nav" aria-label="Main navigation">{navigation.slice(0, 2).map(({ id, label }) => <MagneticButton key={id} className="header-nav-item" aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>{label}</MagneticButton>)}</nav>
        <div className="header-tools">
          <MagneticButton className="header-guide" onClick={openGuide}>Walkthrough</MagneticButton>
          <MagneticButton className="icon-button theme-toggle" aria-label={`Switch to ${appearance.theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${appearance.theme === 'dark' ? 'light' : 'dark'} mode`} onClick={appearance.toggleTheme}>{appearance.theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</MagneticButton>
          <details ref={moreMenu} className="nav-more" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; moreTrigger.current?.focus(); } }}><summary ref={moreTrigger}>More <ChevronDown size={14} /></summary><div className="nav-more-content">{settings}</div></details>
          <MagneticButton ref={menuButton} className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobileNavOpen} aria-controls="mobile-navigation" onClick={() => setMobileNavOpen(true)}><Menu size={21} /></MagneticButton>
        </div>
      </header>
      {mobile && mobileNavOpen && <div className="mobile-navigation-layer"><div className="nav-scrim" aria-hidden="true" onClick={() => setMobileNavOpen(false)} /><aside ref={navDialog} id="mobile-navigation" className="nav-drawer" role="dialog" aria-modal="true" aria-labelledby="navigation-title" onKeyDown={containNavFocus}><div className="nav-drawer-heading"><h2 id="navigation-title">Navigation</h2><MagneticButton ref={closeNavButton} className="icon-button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={20} /></MagneticButton></div><nav aria-label="Mobile navigation">{navigation.slice(0, 2).map(({ id, label }) => <MagneticButton key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>{label}</MagneticButton>)}</nav><div className="nav-drawer-tools">{settings}</div></aside></div>}
      <div className="main-shell" inert={mobile && mobileNavOpen}><main ref={main} id="main-content" className="main-content" tabIndex={-1}>
        {page === 'playground' && <Playground key={exampleVersion} experiment={experiment} reduceMotion={motionReduced} onOpenGuide={openGuide} />}
        {page === 'workbench' && <HowItWorks reduceMotion={motionReduced} onOpenGuide={openGuide} />}
        {page === 'components' && <InteractionStudio reduceMotion={motionReduced} />}
        {page === 'setup' && <LocalSetup api={api} reduceMotion={motionReduced} />}
      </main></div>
      {guideOpen && <SetupGuide reduceMotion={motionReduced} busy={experiment.busy} onUseExample={useExample} onClose={closeGuide} />}
    </div>
  </InteractionMotion.Provider></MotionConfig>;
}
