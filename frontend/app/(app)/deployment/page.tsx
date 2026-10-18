'use client';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { systemAPI } from '@/lib/api';
import { StatusDot, LoadingSpinner } from '@/components/ui/StatusBadges';
import { Cpu, RefreshCw, ExternalLink } from 'lucide-react';

export default function DeploymentPage() {
  const [status, setStatus] = useState<any>(null);
  const [arch, setArch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        systemAPI.status(),
        systemAPI.deployment(),
      ]);
      setStatus(s.data);
      setArch(a.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <AppLayout>
      <div data-tour="deployment" className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#19382D', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Cpu size={22} style={{ color: '#78917C' }} /> Deployment Architecture
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#5A6E63', margin: '4px 0 0 0' }}>
              Current environment + potential Google Cloud production mapping
            </p>
          </div>
          <button 
            onClick={load} 
            disabled={loading} 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              color: '#19382D',
              border: '1px solid #CCD4CD',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
            <span>Refresh</span>
          </button>
        </div>

        {/* Service status */}
        {status && (
          <div 
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #DCE3DD',
              borderRadius: 10,
              padding: '1.5rem',
              boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
            }}
          >
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#19382D', margin: '0 0 1rem 0' }}>Service Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {status.services?.map((svc: any) => (
                <div 
                  key={svc.name} 
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px',
                    borderRadius: 8,
                    backgroundColor: '#F4F3EC',
                    border: '1px solid #EBEAE0',
                  }}
                >
                  <StatusDot status={svc.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#19382D', textTransform: 'capitalize' }}>
                        {svc.name.replace(/_/g, ' ')}
                      </span>
                      {svc.mode && (
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: '#E8F0EA', color: '#166534' }}>
                          {svc.mode}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '11px', color: '#5A6E63', margin: 0 }} className="truncate">{svc.details}</p>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '12px', color: '#5A6E63', margin: '1rem 0 0 0' }}>
              Application mode: <span style={{ fontWeight: 700, color: '#166534' }}>{status.application_mode}</span>
            </p>
          </div>
        )}

        {/* Architecture mapping */}
        {arch && (
          <>
            <div 
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #DCE3DD',
                borderRadius: 10,
                padding: '1.5rem',
                boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
              }}
            >
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#19382D', margin: '0 0 1rem 0' }}>Current Environment (Local)</h2>
              <div className="space-y-2">
                {Object.entries(arch.current_environment).map(([key, val]: [string, any]) => (
                  <div 
                    key={key} 
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '8px 10px',
                      borderRadius: 6,
                      backgroundColor: '#F4F3EC',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ color: '#5A6E63', width: '130px', flexShrink: 0, textTransform: 'capitalize', fontWeight: 500 }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <div>
                      <span style={{ color: '#19382D', fontWeight: 600 }}>{val.service}</span>
                      <span style={{ color: '#78917C', marginLeft: 8, fontSize: '11px' }}>({val.mode})</span>
                      {val.model && <span style={{ fontSize: '11px', color: '#166534', marginLeft: 8, fontWeight: 600 }}>model: {val.model}</span>}
                      {val.path && <span style={{ fontSize: '11px', color: '#83948B', marginLeft: 8 }}>{val.path}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div 
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #DCE3DD',
                borderRadius: 10,
                padding: '1.5rem',
                boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
              }}
            >
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#19382D', margin: '0 0 0.5rem 0' }}>Google Cloud Production Mapping</h2>
              <p style={{ fontSize: '12px', color: '#B45309', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6, padding: '8px 12px', margin: '0 0 1rem 0' }}>
                ⚠ These are potential production options only. EcoSentinel is configured to run fully local and offline.
              </p>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #DCE3DD', color: '#5A6E63' }}>
                      <th className="text-left pb-2 font-semibold">Current (local)</th>
                      <th className="text-left pb-2 font-semibold pl-4">Cloud option</th>
                      <th className="text-left pb-2 font-semibold pl-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arch.google_cloud_production_mapping?.services?.map((s: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid #EBEAE0' }}>
                        <td className="py-2.5 font-medium" style={{ color: '#19382D' }}>{s.current}</td>
                        <td className="py-2.5 pl-4 font-semibold" style={{ color: '#166534' }}>{s.cloud}</td>
                        <td className="py-2.5 pl-4">
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '11px', backgroundColor: '#E8F0EA', color: '#19382D', fontWeight: 600 }}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div 
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3DD',
            borderRadius: 8,
            padding: '1rem',
            fontSize: '12px',
            color: '#5A6E63',
            lineHeight: 1.6,
          }}
        >
          <p style={{ fontWeight: 600, color: '#19382D', margin: '0 0 4px 0' }}>About this architecture</p>
          <p style={{ margin: 0 }}>
            EcoSentinel is designed to run locally with SQLite, Google GenAI / Ollama, and Piper TTS out of the box.
            When deployed to Google Cloud, FastAPI moves to Cloud Run, the database to Cloud SQL (PostgreSQL),
            AI to Vertex AI (Gemini), TTS to Cloud Text-to-Speech, and storage to Cloud Storage.
            Earth Engine authentication enables live satellite analysis.
            The /api/v1/deployment/architecture endpoint documents the full mapping.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
