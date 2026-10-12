/**
 * Adapted from React Bits Stepper, Copyright (c) 2026 David Haz.
 * Upstream: src/ts-tailwind/Components/Stepper/Stepper.tsx
 * Revision: f586a29d6b90a9bf8027b76e978a82230160b8c6
 * License and modification notes: /THIRD_PARTY_NOTICES.md
 */
import { Children, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type Variants } from 'motion/react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import MagneticButton from './MagneticButton';

interface StepperProps {
  children: ReactNode;
  labels: string[];
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  reduceMotion?: boolean;
  className?: string;
}

const stepVariants: Variants = {
  enter: (direction: number) => ({ x: direction >= 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction >= 0 ? -32 : 32, opacity: 0 }),
};

export default function Stepper({
  children,
  labels,
  initialStep = 1,
  onStepChange,
  onFinalStepCompleted,
  reduceMotion = false,
  className = '',
}: StepperProps) {
  const stepsArray = Children.toArray(children);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(0);
  const systemReducedMotion = useReducedMotion();
  const reduced = reduceMotion || Boolean(systemReducedMotion);
  const totalSteps = stepsArray.length;

  function updateStep(newStep: number) {
    if (newStep < 1 || newStep > totalSteps) return;
    setDirection(newStep > currentStep ? 1 : -1);
    setCurrentStep(newStep);
    onStepChange?.(newStep);
  }

  return (
    <div className={`bits-stepper ${className}`}>
      <nav className="step-indicators" aria-label="Setup guide steps">
        {stepsArray.map((_, index) => {
          const step = index + 1;
          const complete = step < currentStep;
          return (
            <div key={step} className="step-indicator-group">
              <button
                type="button"
                className="step-indicator"
                data-active={step === currentStep}
                data-complete={complete}
                aria-current={step === currentStep ? 'step' : undefined}
                aria-label={`Step ${step}: ${labels[index] ?? `Step ${step}`}`}
                onClick={() => updateStep(step)}
              >
                <span className="step-number">{complete ? <Check size={14} /> : step}</span>
                <span>{labels[index]}</span>
              </button>
              {step < totalSteps && (
                <div className="step-connector" aria-hidden="true">
                  <motion.div
                    initial={false}
                    animate={{ scaleX: complete ? 1 : 0 }}
                    transition={{ duration: reduced ? 0 : 0.25 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <StepContentWrapper currentStep={currentStep} direction={direction} reduced={reduced}>
        {stepsArray[currentStep - 1]}
      </StepContentWrapper>
      <div className="stepper-footer">
        <span className="muted">Step {currentStep} of {totalSteps}</span>
        <div className="button-group">
          <MagneticButton className="button secondary small" disabled={currentStep === 1} onClick={() => updateStep(currentStep - 1)}>
            <ArrowLeft size={15} /> Back
          </MagneticButton>
          <MagneticButton
            className="button primary small"
            onClick={() => currentStep === totalSteps ? onFinalStepCompleted?.() : updateStep(currentStep + 1)}
          >
            {currentStep === totalSteps ? 'Finish guide' : 'Continue'}
            {currentStep === totalSteps ? <Check size={15} /> : <ArrowRight size={15} />}
          </MagneticButton>
        </div>
      </div>
    </div>
  );
}

function StepContentWrapper({ currentStep, direction, reduced, children }: {
  currentStep: number;
  direction: number;
  reduced: boolean;
  children: ReactNode;
}) {
  const [height, setHeight] = useState(0);
  return (
    <motion.div
      className="step-content-wrapper"
      animate={{ height }}
      transition={{ duration: reduced ? 0 : 0.25 }}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        <SlideTransition key={currentStep} direction={direction} reduced={reduced} onHeightReady={setHeight}>
          {children}
        </SlideTransition>
      </AnimatePresence>
    </motion.div>
  );
}

function SlideTransition({ children, direction, reduced, onHeightReady }: {
  children: ReactNode;
  direction: number;
  reduced: boolean;
  onHeightReady: (height: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const present = useIsPresent();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !present) return;
    const measure = () => onHeightReady(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightReady, present]);
  return (
    <motion.div
      ref={ref}
      custom={direction}
      variants={reduced ? undefined : stepVariants}
      initial={reduced ? false : 'enter'}
      animate={reduced ? undefined : 'center'}
      exit={reduced ? undefined : 'exit'}
      transition={{ duration: reduced ? 0 : 0.2 }}
      className="step-slide"
      inert={!present}
      aria-hidden={!present || undefined}
    >
      {children}
    </motion.div>
  );
}

export function Step({ children }: { children: ReactNode }) {
  return <div className="step-body">{children}</div>;
}
