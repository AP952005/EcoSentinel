'use client';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { systemAPI, authAPI } from '@/lib/api';
import { StatusDot, LoadingSpinner } from '@/components/ui/StatusBadges';
import { Settings, Key, Shield, RefreshCw, Globe, Sparkles, MapPin } from 'lucide-react';
import { getActiveAOI, resetActiveAOI, type ActiveAOI } from '@/lib/aoi-store';

export default function SettingsPage() {
  const { user } = useAuth();
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [ttsStatus, setTtsStatus] = useState<any>(null);
  const [checkingAI, setCheckingAI] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [aoi, setAoi] = useState<ActiveAOI | null>(null);

  useEffect(() => {
    setAoi(getActiveAOI());
    checkServices();
  }, []);

  async function checkServices() {
    setCheckingAI(true);
    try {
      const [ai, tts] = await Promise.all([
        systemAPI.aiStatus(),
        systemAPI.ttsStatus(),
      ]);
      setAiStatus(ai.data);
      setTtsStatus(tts.data);
    } catch {
      // fallback
    } finally {
      setCheckingAI(false);
    }
  }

  function handleResetAOI() {
    const res = resetActiveAOI();
    setAoi(res);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) { setPwMsg('Passwords do not match'); return; }
    try {
      await authAPI.changePassword({ current_password: pw.current, new_password: pw.next });
      setPwMsg('Password changed successfully');
      setPw({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      setPwMsg(err?.response?.data?.detail || 'Password change failed');
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#19382D', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Settings size={22} style={{ color: '#78917C' }} /> Settings
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#5A6E63', margin: '4px 0 0 0' }}>
            Account, Planetary AOI, and Service Configuration
          </p>
        </div>

        {/* Active AOI Persistence */}
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3DD',
            borderRadius: 10,
            padding: '1.5rem',
            boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #EBEAE0', paddingBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#19382D', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Globe size={16} style={{ color: '#78917C' }} /> Active Planetary AOI
            </h2>
            <button
              onClick={handleResetAOI}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: 6,
                backgroundColor: '#F4F3EC',
                color: '#19382D',
                border: '1px solid #CCD4CD',
                cursor: 'pointer',
              }}
            >
              Reset to West Kalimantan
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span style={{ color: '#5A6E63', width: '130px', fontWeight: 500 }}>Place Name</span>
              <span style={{ color: '#19382D', fontWeight: 600 }}>{aoi?.place_name || 'Ketapang Regency'}</span>
            </div>
            <div className="flex gap-2">
              <span style={{ color: '#5A6E63', width: '130px', fontWeight: 500 }}>Region / State</span>
              <span style={{ color: '#19382D' }}>{aoi?.state || 'West Kalimantan'}</span>
            </div>
            <div className="flex gap-2">
              <span style={{ color: '#5A6E63', width: '130px', fontWeight: 500 }}>Country</span>
              <span style={{ color: '#19382D' }}>{aoi?.country || 'Indonesia'}</span>
            </div>
            <div className="flex gap-2">
              <span style={{ color: '#5A6E63', width: '130px', fontWeight: 500 }}>Coordinates</span>
              <span style={{ color: '#166534', fontFamily: 'monospace', fontWeight: 600, fontSize: '12px' }}>
                {aoi?.centroid ? `${aoi.centroid.lat.toFixed(4)}°, ${aoi.centroid.lng.toFixed(4)}°` : '-1.8500°, 109.9700°'}
              </span>
            </div>
            <div className="flex gap-2">
              <span style={{ color: '#5A6E63', width: '130px', fontWeight: 500 }}>Screening Buffer</span>
              <span style={{ color: '#19382D' }}>{aoi?.radius_km || 4} km ({aoi?.buffer_area_ha ? aoi.buffer_area_ha.toLocaleString() : '5,027'} ha)</span>
            </div>
          </div>
        </div>

        {/* Account */}
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3DD',
            borderRadius: 10,
            padding: '1.5rem',
            boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
          }}
        >
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#19382D', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} style={{ color: '#78917C' }} /> Account
          </h2>
          <div className="space-y-2 text-sm mb-6">
            {[
              ['Name', user?.full_name],
              ['Email', user?.email],
              ['Role', user?.role],
              ['Organization', user?.organization || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span style={{ color: '#5A6E63', width: '130px', fontWeight: 500 }}>{k}</span>
                <span style={{ color: '#19382D', fontWeight: 600, textTransform: 'capitalize' }}>{v}</span>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#19382D', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Key size={14} style={{ color: '#78917C' }} /> Change Password
          </h3>
          <form onSubmit={changePassword} className="space-y-3">
            {['current', 'next', 'confirm'].map((f) => (
              <div key={f}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#19382D', marginBottom: 4, textTransform: 'capitalize' }}>
                  {f === 'next' ? 'New password' : f === 'confirm' ? 'Confirm new' : 'Current password'}
                </label>
                <input 
                  type="password" 
                  value={(pw as any)[f]}
                  onChange={e => setPw(p => ({ ...p, [f]: e.target.value }))} 
                  minLength={8} 
                  required 
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: '13px',
                    border: '1px solid #CCD4CD',
                    backgroundColor: '#FFFFFF',
                    color: '#19382D',
                  }}
                />
              </div>
            ))}
            {pwMsg && (
              <p style={{ fontSize: '12px', fontWeight: 600, color: pwMsg.includes('success') ? '#166534' : '#DC2626' }}>{pwMsg}</p>
            )}
            <button 
              type="submit" 
              style={{
                padding: '7px 16px',
                borderRadius: 6,
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#19382D',
                color: '#FFFFFF',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Change password
            </button>
          </form>
        </div>

        {/* Service check */}
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3DD',
            borderRadius: 10,
            padding: '1.5rem',
            boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #EBEAE0', paddingBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#19382D', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <RefreshCw size={16} style={{ color: '#78917C' }} /> AI &amp; Cloud Services
            </h2>
            <button 
              onClick={checkServices} 
              disabled={checkingAI} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#FFFFFF',
                color: '#19382D',
                border: '1px solid #CCD4CD',
                cursor: 'pointer',
              }}
            >
              {checkingAI ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />}
              <span>Check services</span>
            </button>
          </div>

          <div className="space-y-3">
            {/* Primary Google GenAI */}
            <div style={{ backgroundColor: '#E8F0EA', border: '1px solid #C4D7C8', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#166534' }} />
                  <span style={{ fontWeight: 700, color: '#19382D', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} style={{ color: '#166534' }} /> Google GenAI (gemini-3.8-flash)
                  </span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#D5E6D8', color: '#166534' }}>
                  PRIMARY REASONING ENGINE
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#5A6E63', margin: 0 }}>
                {aiStatus?.google_genai?.details || 'Connected to Google GenAI with STAC Earth Observation reasoning and multi-temporal synthesis.'}
              </p>
            </div>

            {/* Ollama Standby */}
            <div style={{ backgroundColor: '#F4F3EC', border: '1px solid #EBEAE0', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StatusDot status={aiStatus?.ollama?.status || 'not_connected'} />
                  <span style={{ fontWeight: 600, color: '#19382D', fontSize: '13px' }}>Ollama / Local AI</span>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#83948B' }}>SECONDARY STANDBY</span>
              </div>
              <p style={{ fontSize: '12px', color: '#5A6E63', margin: 0 }}>{aiStatus?.ollama?.details || 'Local offline fallback engine'}</p>
            </div>

            {/* TTS */}
            {ttsStatus && (
              <div style={{ backgroundColor: '#F4F3EC', border: '1px solid #EBEAE0', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <StatusDot status={ttsStatus.status} />
                  <span style={{ fontWeight: 600, color: '#19382D', fontSize: '13px' }}>Piper TTS</span>
                </div>
                <p style={{ fontSize: '12px', color: '#5A6E63', margin: 0 }}>{ttsStatus.details || ttsStatus.voice || 'Not configured'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Environment note */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #DCE3DD', borderRadius: 8, padding: '1rem', fontSize: '12px', color: '#5A6E63' }}>
          <p style={{ fontWeight: 600, color: '#19382D', marginBottom: 4 }}>Local configuration</p>
          <p style={{ margin: 0 }}>
            Edit <code style={{ backgroundColor: '#EBEAE0', padding: '1px 5px', borderRadius: 4, color: '#19382D' }}>backend/.env</code> to configure Google GenAI, Ollama, Piper TTS, and Earth Engine.
            See <code style={{ backgroundColor: '#EBEAE0', padding: '1px 5px', borderRadius: 4, color: '#19382D' }}>.env.example</code> for all available settings.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
