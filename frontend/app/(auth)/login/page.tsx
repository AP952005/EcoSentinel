'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';
import { Eye, EyeOff, LogIn, Shield, Award, FileText, CheckCircle2 } from 'lucide-react';

// Inner form — isolated here because useSearchParams() requires Suspense
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams?.get('registered');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Invalid credentials';
      setError(Array.isArray(msg) ? msg.map((m: any) => m.msg).join(', ') : msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickLogin(quickEmail: string, quickPass: string) {
    setEmail(quickEmail);
    setPassword(quickPass);
    setError('');
    setLoading(true);
    try {
      await login(quickEmail, quickPass);
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Login failed';
      setError(Array.isArray(msg) ? msg.map((m: any) => m.msg).join(', ') : msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="p-6 sm:p-8 rounded-2xl border"
      style={{
        background: 'var(--surface-white)',
        borderColor: 'var(--soft-border)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold font-serif" style={{ color: 'var(--canopy-ink)' }}>
          Sign in to EcoSentinel
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--ink-slate)' }}>
          Access your investigation dossiers &amp; spatial GIS workspace
        </p>
      </div>

      {registered && (
        <div className="mb-4 p-3 rounded-lg border flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border-emerald-200">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span>Account registered successfully! Please sign in with your credentials.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg border text-xs text-red-800 bg-red-50 border-red-200">
          {error}
        </div>
      )}

      {/* Quick 1-Click Role Logins */}
      <div className="mb-5 space-y-2">
        <label
          className="block text-[11px] font-mono uppercase tracking-wider font-semibold"
          style={{ color: 'var(--ink-slate)' }}
        >
          Instant Demo Access (Click to Login)
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleQuickLogin('admin@ecosentinel.io', 'Admin@1234')}
            disabled={loading}
            className="p-2 rounded-lg border text-left transition-all hover:shadow-sm"
            style={{ background: '#FAF8F5', borderColor: 'var(--soft-border)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Shield size={12} className="text-amber-600" />
              <span className="text-[11px] font-bold" style={{ color: 'var(--canopy-ink)' }}>Admin</span>
            </div>
            <span className="text-[10px] block" style={{ color: 'var(--river-sage)' }}>Full Authority</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin('officer@ecosentinel.io', 'Officer@1234')}
            disabled={loading}
            className="p-2 rounded-lg border text-left transition-all hover:shadow-sm"
            style={{ background: '#FAF8F5', borderColor: 'var(--soft-border)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Award size={12} className="text-emerald-600" />
              <span className="text-[11px] font-bold" style={{ color: 'var(--canopy-ink)' }}>Officer</span>
            </div>
            <span className="text-[10px] block" style={{ color: 'var(--river-sage)' }}>MoEFCC Audit</span>
          </button>

          <button
            type="button"
            onClick={() => handleQuickLogin('applicant@ecosentinel.io', 'Applicant@1234')}
            disabled={loading}
            className="p-2 rounded-lg border text-left transition-all hover:shadow-sm"
            style={{ background: '#FAF8F5', borderColor: 'var(--soft-border)' }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <FileText size={12} className="text-blue-600" />
              <span className="text-[11px] font-bold" style={{ color: 'var(--canopy-ink)' }}>Applicant</span>
            </div>
            <span className="text-[10px] block" style={{ color: 'var(--river-sage)' }}>Concession</span>
          </button>
        </div>
      </div>

      <div className="relative my-4 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" style={{ borderColor: 'var(--soft-border)' }} />
        </div>
        <span
          className="relative px-3 text-[10px] font-mono uppercase tracking-wider"
          style={{ background: 'var(--surface-white)', color: 'var(--river-sage)' }}
        >
          Or sign in with email
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--canopy-ink)' }}>
            Email Address
          </label>
          <input
            type="email"
            className="w-full px-3 py-2 text-xs rounded-lg border font-sans focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--soft-border)',
              background: 'var(--surface-white)',
              color: 'var(--canopy-ink)',
            }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@ecosentinel.io"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--canopy-ink)' }}>
            Password
          </label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              className="w-full px-3 py-2 pr-9 text-xs rounded-lg border font-sans focus:outline-none focus:ring-2"
              style={{
                borderColor: 'var(--soft-border)',
                background: 'var(--surface-white)',
                color: 'var(--canopy-ink)',
              }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setShow(!show)}
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          style={{ background: 'var(--forest-sage)', color: 'var(--surface-white)' }}
        >
          <LogIn size={14} />
          <span>{loading ? 'Authenticating…' : 'Sign in to Platform'}</span>
        </button>
      </form>

      {/* Google Firebase Sign In */}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-2 px-4 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          style={{
            borderColor: 'var(--soft-border)',
            background: 'var(--surface-white)',
            color: 'var(--canopy-ink)',
          }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          Continue with Google (Firebase)
        </button>
      </div>

      <div
        className="mt-5 pt-4 border-t text-center text-xs"
        style={{ borderColor: 'var(--soft-border)', color: 'var(--ink-slate)' }}
      >
        Need an account with a specific role?{' '}
        <Link
          href="/register"
          className="font-semibold underline underline-offset-2"
          style={{ color: 'var(--forest-sage)' }}
        >
          Register as Admin / Officer / Applicant
        </Link>
      </div>
    </div>
  );
}

// Page shell — no dynamic hooks; safe for static prerendering
export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'var(--mineral-paper)' }}
    >
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">

        {/* Left Column: Context & Real Project Showcase */}
        <div className="md:col-span-6 space-y-6">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 5,
                flexShrink: 0,
                boxShadow: '0 2px 10px rgba(25,56,45,0.2)',
                border: '1px solid #E8F0EA',
              }}
            >
              <Image
                src="/logo.png"
                alt="EcoSentinel Logo"
                width={46}
                height={46}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <div>
              <h1
                className="text-xl font-bold font-serif tracking-tight"
                style={{ color: 'var(--canopy-ink)' }}
              >
                EcoSentinel ProofLoop
              </h1>
              <p className="text-xs font-mono font-medium" style={{ color: 'var(--river-sage)' }}>
                Planetary Environmental Intelligence
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2
              className="text-2xl sm:text-3xl font-serif font-bold leading-tight"
              style={{ color: 'var(--canopy-ink)' }}
            >
              Independent multi-sensor verification for earth observations.
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--ink-slate)' }}>
              Cross-verifying satellite telemetry (Copernicus Sentinel-2, Landsat, Hansen Global
              Forest Change) with concession claims to produce legally auditable Environmental
              Intelligence Reports (FER).
            </p>
          </div>

          {/* Real Showcase Project Card */}
          <div
            className="p-4 rounded-xl border transition-all"
            style={{
              background: 'var(--surface-white)',
              borderColor: 'var(--soft-border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                style={{ background: '#FBEBE8', color: 'var(--terra-alert)' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ background: 'var(--terra-alert)' }}
                />
                ACTIVE INVESTIGATION
              </span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--river-sage)' }}>
                Borneo · -0.925°S, 109.941°E
              </span>
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--canopy-ink)' }}>
              PT Mayawana Persada Concession
            </h3>
            <p className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--ink-slate)' }}>
              Real satellite analysis: 14,280 ha tropical peatland deforestation documented
              (2021–2024). Corroborated with Sentinel-2 NDVI spectral decline and Hansen GFC pixels.
            </p>
            <div
              className="grid grid-cols-3 gap-2 pt-2 border-t text-center"
              style={{ borderColor: 'var(--soft-border)' }}
            >
              <div>
                <span className="block text-[10px] uppercase font-mono" style={{ color: 'var(--river-sage)' }}>Baseline NDVI</span>
                <span className="text-xs font-bold font-mono text-emerald-700">0.82</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-mono" style={{ color: 'var(--river-sage)' }}>Latest NDVI</span>
                <span className="text-xs font-bold font-mono text-amber-700">0.44</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase font-mono" style={{ color: 'var(--river-sage)' }}>Confidence</span>
                <span className="text-xs font-bold font-mono text-indigo-700">94.8%</span>
              </div>
            </div>
          </div>

          {/* Mascot intro teaser */}
          <div
            className="flex items-center gap-3 p-3 rounded-lg border text-xs"
            style={{
              background: 'rgba(25, 56, 45, 0.05)',
              borderColor: '#DCE3DD',
              color: '#19382D',
            }}
          >
            <Avatar state="greeting" size={36} />
            <div>
              <span className="font-semibold block" style={{ color: 'var(--canopy-ink)' }}>
                Need a guided walkthrough?
              </span>
              <span>
                Our local AI environmental agent guides you through every layer once logged in.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column — LoginForm uses useSearchParams, must be in Suspense */}
        <div className="md:col-span-6">
          <Suspense
            fallback={
              <div
                className="p-6 sm:p-8 rounded-2xl border animate-pulse"
                style={{
                  background: 'var(--surface-white)',
                  borderColor: 'var(--soft-border)',
                  minHeight: 420,
                }}
              />
            }
          >
            <LoginForm />
          </Suspense>
        </div>

      </div>
    </div>
  );
}
