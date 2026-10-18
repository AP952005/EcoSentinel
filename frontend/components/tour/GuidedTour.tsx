'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { X, ChevronRight, ChevronLeft, SkipForward, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { TOUR_STEPS, AVATAR_ASSETS } from '@/lib/avatars';
import { ttsAPI } from '@/lib/api';

interface TourProps {
  onComplete: () => void;
  onSkip: () => void;
  startStep?: number;
}

export function GuidedTour({ onComplete, onSkip, startStep = 0 }: TourProps) {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(startStep);
  const [visible, setVisible] = useState(false);
  const [avatarPos, setAvatarPos] = useState({ x: 0, y: 0 });
  const [targetPos, setTargetPos] = useState({ x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const narrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeNarrationIdRef = useRef<number>(0);
  const lastNarratedStepRef = useRef<number | null>(null);

  const step = TOUR_STEPS[stepIdx];
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === TOUR_STEPS.length - 1;

  // Find anchor element position, with graceful fallback to sidebar nav item or viewport center
  const findAnchorPos = useCallback((anchor: string): { x: number; y: number } => {
    // 1. Try exact content anchor
    let el = document.querySelector(`[data-tour="${anchor}"]`);
    // 2. If not found, try sidebar link matching step
    if (!el) {
      el = document.querySelector(`nav [data-tour="${anchor}"]`);
    }
    if (!el) {
      return { x: Math.max(160, window.innerWidth / 2), y: Math.max(120, window.innerHeight / 2 - 60) };
    }
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(100, Math.min(rect.left + rect.width / 2, window.innerWidth - 120)),
      y: Math.max(80, Math.min(rect.bottom + 16, window.innerHeight - 200)),
    };
  }, []);

  // Poll for element across route transitions
  const waitForAnchor = useCallback(async (anchor: string, maxWaitMs = 1200): Promise<Element | null> => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const el = document.querySelector(`[data-tour="${anchor}"]`);
      if (el) return el;
      await new Promise(r => setTimeout(r, 100));
    }
    return document.querySelector(`[data-tour="${anchor}"]`);
  }, []);

  // Move avatar to target
  const moveToTarget = useCallback(async (newStep: typeof TOUR_STEPS[0]) => {
    setMoving(true);

    // Navigate route if needed
    if (newStep.route && window.location.pathname !== newStep.route) {
      router.push(newStep.route);
      await new Promise(r => setTimeout(r, 800));
    }

    // Wait for element to mount
    await waitForAnchor(newStep.anchor, 1200);

    const target = findAnchorPos(newStep.anchor);
    setTargetPos(target);
    await new Promise(r => setTimeout(r, 700));
    setAvatarPos(target);
    setMoving(false);
  }, [findAnchorPos, router, waitForAnchor]);

  function stopSpeaking() {
    if (narrationTimerRef.current) {
      clearTimeout(narrationTimerRef.current);
      narrationTimerRef.current = null;
    }
    activeNarrationIdRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  const speakBrowser = useCallback((text: string, currentId: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSpeaking(false);
      return;
    }
    // Cancel previous audio and speech completely
    window.speechSynthesis.cancel();

    // Small delay ensures Chrome/Edge SpeechSynthesis engine resets its internal audio buffer
    setTimeout(() => {
      if (activeNarrationIdRef.current !== currentId) return;

      const u = new SpeechSynthesisUtterance(text.slice(0, 500));
      u.rate = 0.92;
      u.pitch = 1.0;
      u.onend = () => {
        if (activeNarrationIdRef.current === currentId) setSpeaking(false);
      };
      u.onerror = () => {
        if (activeNarrationIdRef.current === currentId) setSpeaking(false);
      };
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    }, 40);
  }, []);

  // Narrate step with single-flight idempotency
  const narrate = useCallback(async (text: string) => {
    if (!ttsEnabled) return;

    // Advance ID and invalidate any pending speech
    activeNarrationIdRef.current += 1;
    const thisNarrationId = activeNarrationIdRef.current;

    stopSpeaking();
    activeNarrationIdRef.current = thisNarrationId;
    setSpeaking(true);

    try {
      // Try backend Piper TTS first
      const r = await ttsAPI.synthesize(text.slice(0, 500));
      if (activeNarrationIdRef.current !== thisNarrationId) return;

      if (r.data.engine !== 'browser_fallback' && r.data.audio_id) {
        const url = ttsAPI.getAudio(r.data.audio_id);
        const audio = new Audio(url);
        audioRef.current = audio;

        await new Promise<void>((resolve) => {
          audio.onended = () => {
            if (activeNarrationIdRef.current === thisNarrationId) setSpeaking(false);
            resolve();
          };
          audio.onerror = () => {
            if (activeNarrationIdRef.current === thisNarrationId) {
              speakBrowser(text, thisNarrationId);
            }
            resolve();
          };
          audio.play().catch(() => {
            if (activeNarrationIdRef.current === thisNarrationId) {
              speakBrowser(text, thisNarrationId);
            }
            resolve();
          });
        });
      } else {
        speakBrowser(text, thisNarrationId);
      }
    } catch {
      if (activeNarrationIdRef.current === thisNarrationId) {
        speakBrowser(text, thisNarrationId);
      }
    }
  }, [speakBrowser, ttsEnabled]);

  // Initialize tour — strictly once per mount
  useEffect(() => {
    setVisible(true);
    const pos = findAnchorPos(step.anchor);
    setAvatarPos(pos);
    setTargetPos(pos);

    // Prevent double invocation in React StrictMode
    if (lastNarratedStepRef.current !== stepIdx) {
      lastNarratedStepRef.current = stepIdx;
      if (narrationTimerRef.current) clearTimeout(narrationTimerRef.current);
      narrationTimerRef.current = setTimeout(() => {
        narrate(step.narration);
        const el = document.querySelector(`[data-tour="${step.anchor}"]`);
        if (el) {
          el.classList.add('tour-highlight');
          try {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          } catch {}
        }
      }, 500);
    }

    return () => {
      if (narrationTimerRef.current) {
        clearTimeout(narrationTimerRef.current);
        narrationTimerRef.current = null;
      }
      document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
      stopSpeaking();
    };
  }, []);

  const goToStep = useCallback(async (idx: number) => {
    // Persist step before navigation so route transitions never drop the tour
    try {
      localStorage.setItem('eco-tour-in-progress', String(idx));
    } catch {}

    // Remove highlight and stop speech
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    stopSpeaking();

    const nextStep = TOUR_STEPS[idx];
    const willNavigate = Boolean(nextStep.route && window.location.pathname !== nextStep.route);

    if (willNavigate) {
      // The incoming page will mount GuidedTour and narrate this step.
      // Calling narrate here would create duplicate speech!
      router.push(nextStep.route!);
      return;
    }

    // Same-page step transition:
    await moveToTarget(nextStep);
    setStepIdx(idx);

    await new Promise(r => setTimeout(r, 300));
    const el = document.querySelector(`[data-tour="${nextStep.anchor}"]`) ||
               document.querySelector(`nav [data-tour="${nextStep.anchor}"]`);
    if (el) {
      el.classList.add('tour-highlight');
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch {}
    }
    lastNarratedStepRef.current = idx;
    narrate(nextStep.narration);
  }, [moveToTarget, narrate, router]);

  function next() {
    if (isLast) {
      finish();
    } else {
      goToStep(stepIdx + 1);
    }
  }

  function back() {
    if (!isFirst) goToStep(stepIdx - 1);
  }

  function finish() {
    try { localStorage.removeItem('eco-tour-in-progress'); } catch {}
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    stopSpeaking();
    onComplete();
  }

  function skip() {
    try { localStorage.removeItem('eco-tour-in-progress'); } catch {}
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    stopSpeaking();
    onSkip();
  }

  // Reduce motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const avatarSrc = moving
    ? (targetPos.x > avatarPos.x ? AVATAR_ASSETS['cycling_right'] : AVATAR_ASSETS['cycling_left'])
    : AVATAR_ASSETS[step.avatar];

  if (!visible) return null;

  return (
    <>
      {/* Backdrop overlay (light, so app is visible) */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 8900, background: 'rgba(0,0,0,0.15)' }}
      />

      {/* Moving avatar */}
      <div
        className="fixed pointer-events-none"
        style={{
          zIndex: 9100,
          left: targetPos.x - 40,
          top: targetPos.y - 40,
          transition: prefersReducedMotion ? 'none' : 'left 0.7s cubic-bezier(0.4,0,0.2,1), top 0.7s cubic-bezier(0.4,0,0.2,1)',
          width: 80, height: 80,
        }}
      >
        <Image
          src={avatarSrc}
          alt={`EcoSentinel assistant — ${step.avatar}`}
          width={80} height={80}
          style={{ objectFit: 'contain' }}
          priority
        />
      </div>

      {/* Step panel — positioned near bottom center, avoiding overlap */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 eco-card border border-slate-600 shadow-2xl shadow-black/60 w-full max-w-lg mx-4 animate-fade-in-up"
        style={{ zIndex: 9200 }}
      >
        {/* Progress bar */}
        <div className="h-0.5 bg-slate-800 rounded-t-xl overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${((stepIdx + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-teal-400 font-mono">Step {stepIdx + 1} of {TOUR_STEPS.length}</span>
                {speaking && (
                  <span className="text-xs text-violet-400 flex items-center gap-1 animate-pulse">
                    <Volume2 size={10} /> Speaking…
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-100">{step.title}</h3>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setTtsEnabled(e => !e); if (speaking) stopSpeaking(); }}
                className="p-1.5 text-slate-500 hover:text-slate-300 rounded"
                title={ttsEnabled ? 'Mute narration' : 'Unmute narration'}
              >
                {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
              <button
                onClick={() => narrate(step.narration)}
                className="p-1.5 text-slate-500 hover:text-slate-300 rounded"
                title="Replay narration"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={skip}
                className="p-1.5 text-slate-500 hover:text-red-400 rounded"
                title="Skip tour"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Narration text */}
          <p className="text-sm text-slate-300 leading-relaxed mb-4">{step.narration}</p>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <button
              onClick={skip}
              className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
            >
              <SkipForward size={12} /> Skip tour
            </button>

            <div className="flex items-center gap-2">
              {/* Step dots */}
              <div className="flex gap-1">
                {TOUR_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToStep(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === stepIdx ? 'bg-teal-400 w-3' : 'bg-slate-700 hover:bg-slate-500'}`}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={back}
                disabled={isFirst}
                className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-30"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                onClick={next}
                className="btn-primary text-sm px-4 py-1.5"
              >
                {isLast ? 'Finish tour' : <>Next <ChevronRight size={14} /></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
