'use client';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/layout/Sidebar';
import { EcoSentinelAssistant } from '@/components/layout/EcoSentinelAssistant';
import { GuidedTour } from '@/components/tour/GuidedTour';
import { LoadingSpinner } from '@/components/ui/StatusBadges';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type PageContext = {
  type: 'dashboard' | 'project' | 'map' | 'finding' | 'chat' | 'settings' | 'general';
  label?: string;
  projectId?: string;
};

function usePageContext(): PageContext {
  const pathname = usePathname();
  if (pathname === '/dashboard') return { type: 'dashboard', label: 'Dashboard' };
  if (pathname.startsWith('/projects')) return { type: 'project', label: 'Projects' };
  if (pathname.startsWith('/map')) return { type: 'map', label: 'Environmental Map' };
  if (pathname.startsWith('/shadow-footprint')) return { type: 'finding', label: 'Shadow Footprint' };
  if (pathname.startsWith('/chat')) return { type: 'chat', label: 'AI Chat' };
  if (pathname.startsWith('/settings')) return { type: 'settings', label: 'Settings' };
  return { type: 'general' };
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const context = usePageContext();

  const [showTour, setShowTour] = useState(false);
  const [tourStartStep, setTourStartStep] = useState(0);
  const [tourChecked, setTourChecked] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // Check if tour is currently active or if first login → offer tour
  useEffect(() => {
    if (!user) return;
    try {
      const activeStep = localStorage.getItem('eco-tour-in-progress');
      if (activeStep !== null) {
        setTourStartStep(Number(activeStep) || 0);
        setShowTour(true);
        return;
      }
      if (!tourChecked) {
        setTourChecked(true);
        const tourKey = `eco-tour-done-${user.id}`;
        const done = localStorage.getItem(tourKey);
        if (!done && user.is_first_login !== false) {
          // Small delay so page renders first
          setTimeout(() => {
            localStorage.setItem('eco-tour-in-progress', '0');
            setTourStartStep(0);
            setShowTour(true);
          }, 800);
        }
      }
    } catch {}
  }, [user, tourChecked]);

  function startReplayTour() {
    try {
      localStorage.setItem('eco-tour-in-progress', '0');
      setTourStartStep(0);
      setShowTour(true);
    } catch {}
  }

  function completeTour() {
    setShowTour(false);
    try {
      localStorage.removeItem('eco-tour-in-progress');
      if (user) localStorage.setItem(`eco-tour-done-${user.id}`, '1');
    } catch {}
  }

  function skipTour() {
    setShowTour(false);
    try {
      localStorage.removeItem('eco-tour-in-progress');
      if (user) localStorage.setItem(`eco-tour-done-${user.id}`, 'skipped');
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <LoadingSpinner size={40} />
          <p className="text-sm text-slate-400">Loading EcoSentinel…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar onReplayTour={startReplayTour} />
      <main className="flex-1 ml-64 min-h-screen overflow-auto">
        <div className="p-8">
          {children}
        </div>
      </main>

      {/* Persistent floating assistant — always visible on authenticated pages */}
      <EcoSentinelAssistant context={context} tourActive={showTour} />

      {/* Guided tour overlay */}
      {showTour && (
        <GuidedTour
          startStep={tourStartStep}
          onComplete={completeTour}
          onSkip={skipTour}
        />
      )}
    </div>
  );
}
