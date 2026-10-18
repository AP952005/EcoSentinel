'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/Avatar';
import { Eye, EyeOff, Shield, Award, FileText, Globe, UserCheck, CheckCircle2, ArrowRight } from 'lucide-react';

const ROLES = [
  {
    id: 'admin',
    name: 'Administrator',
    icon: Shield,
    badgeColor: '#D97706',
    desc: 'Platform governance, global audits & user authority',
  },
  {
    id: 'officer',
    name: 'Compliance Officer',
    icon: Award,
    badgeColor: '#059669',
    desc: 'Permit verification, Watchtower surveillance & official FER issuance',
  },
  {
    id: 'applicant',
    name: 'Concession Applicant',
    icon: FileText,
    badgeColor: '#2563EB',
    desc: 'Project AOI intake, proof submission & compliance reports',
  },
  {
    id: 'viewer',
    name: 'Auditor / Viewer',
    icon: Globe,
    badgeColor: '#7C3AED',
    desc: 'Read-only multi-sensor GIS inspection & open public audit',
  },
  {
    id: 'user',
    name: 'General Researcher',
    icon: UserCheck,
    badgeColor: '#47745C',
    desc: 'Environmental research, deforestation analytics & change detection',
  },
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    organization: '',
    role: 'applicant',
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { registerWithFirebase, loginWithGoogle } = useAuth();

  function update(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerWithFirebase(form);
      router.push('/dashboard');
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message;
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(', '));
      } else {
        setError(detail || 'Registration failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(form.role);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 py-12" style={{ background: 'var(--mineral-paper)' }}>
      <div className="w-full max-w-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div 
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              flexShrink: 0,
              boxShadow: '0 4px 16px rgba(25,56,45,0.18)',
              border: '1px solid #E8F0EA'
            }}
          >
            <Image
              src="/logo.png"
              alt="EcoSentinel Logo"
              width={52}
              height={52}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <div>
            <h1 className="text-xl font-bold font-serif tracking-tight" style={{ color: 'var(--canopy-ink)' }}>
              EcoSentinel ProofLoop
            </h1>
            <p className="text-xs font-mono font-medium" style={{ color: 'var(--river-sage)' }}>
              Create Environmental Investigation Account
            </p>
          </div>
        </div>

        <div 
          className="p-6 sm:p-8 rounded-2xl border"
          style={{ 
            background: 'var(--surface-white)', 
            borderColor: 'var(--soft-border)',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold font-serif" style={{ color: 'var(--canopy-ink)' }}>
              Register Platform Account
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-slate)' }}>
              Select your operational role. New users can be registered as Admin, Compliance Officer, Applicant, or Auditor.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg border text-xs text-red-800 bg-red-50 border-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Selection */}
            <div>
              <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--canopy-ink)' }}>
                Select Your Assigned Authority / Role
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const isSelected = form.role === r.id;
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => update('role', r.id)}
                      className="p-3 rounded-xl border text-left transition-all relative"
                      style={{
                        background: isSelected ? '#FAF8F5' : 'var(--surface-white)',
                        borderColor: isSelected ? r.badgeColor : 'var(--soft-border)',
                        boxShadow: isSelected ? 'var(--shadow-xs)' : 'none',
                        borderWidth: isSelected ? '2px' : '1px',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon size={16} style={{ color: r.badgeColor }} />
                          <span className="text-xs font-bold" style={{ color: 'var(--canopy-ink)' }}>
                            {r.name}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle2 size={15} style={{ color: r.badgeColor }} />
                        )}
                      </div>
                      <p className="text-[11px] leading-tight" style={{ color: 'var(--ink-slate)' }}>
                        {r.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Full Name & Organization */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--canopy-ink)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs rounded-lg border font-sans focus:outline-none focus:ring-2"
                  style={{ 
                    borderColor: 'var(--soft-border)', 
                    background: 'var(--surface-white)',
                    color: 'var(--canopy-ink)'
                  }}
                  value={form.full_name}
                  onChange={(e) => update('full_name', e.target.value)}
                  placeholder="e.g. Dr. Maya Hartono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--canopy-ink)' }}>
                  Organization / Entity
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-xs rounded-lg border font-sans focus:outline-none focus:ring-2"
                  style={{ 
                    borderColor: 'var(--soft-border)', 
                    background: 'var(--surface-white)',
                    color: 'var(--canopy-ink)'
                  }}
                  value={form.organization}
                  onChange={(e) => update('organization', e.target.value)}
                  placeholder="e.g. Ministry of Environment / Forestry NGO"
                />
              </div>
            </div>

            {/* Email & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    color: 'var(--canopy-ink)'
                  }}
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="name@domain.com"
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
                      color: 'var(--canopy-ink)'
                    }}
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    autoComplete="new-password"
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
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              style={{ 
                background: 'var(--forest-sage)', 
                color: 'var(--surface-white)' 
              }}
            >
              <span>{loading ? 'Creating Account & Initializing...' : `Register as ${ROLES.find(r => r.id === form.role)?.name}`}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          {/* Google Sign-up with selected role */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleGoogleSignUp}
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              style={{ 
                borderColor: 'var(--soft-border)', 
                background: 'var(--surface-white)',
                color: 'var(--canopy-ink)'
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Register with Google (as {ROLES.find(r => r.id === form.role)?.name})
            </button>
          </div>

          <div className="mt-5 pt-4 border-t text-center text-xs" style={{ borderColor: 'var(--soft-border)', color: 'var(--ink-slate)' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold underline underline-offset-2" style={{ color: 'var(--forest-sage)' }}>
              Sign in with existing credentials or demo accounts
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
