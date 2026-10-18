'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth-context';
import { projectsAPI, watchAPI, casesAPI } from '@/lib/api';
import { LoadingSpinner, EmptyState } from '@/components/ui/StatusBadges';
import { 
  Leaf, FolderOpen, Eye, AlertTriangle, Activity, Plus, 
  Map, Sparkles, FileText, Layers, Globe, ArrowRight,
  ShieldAlert, Clock
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [watchPlans, setWatchPlans] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      projectsAPI.list().then(r => setProjects(r.data || [])),
      watchAPI.list().then(r => setWatchPlans(r.data || [])),
      casesAPI.list().then(r => setCases(r.data || [])),
    ]).finally(() => setLoading(false));
  }, []);

  const openCases = cases.filter(c => c.status === 'open').length;
  const activeWatchers = watchPlans.filter(w => w.status === 'active').length;

  const [greeting, setGreeting] = useState('day');

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('morning');
    else if (h < 17) setGreeting('afternoon');
    else setGreeting('evening');
  }, []);

  const mayawana = projects.find(
    p => p.id === 'demo-mayawana-ketapang-west-kalimantan-002' || (p.project_name && p.project_name.includes('Mayawana'))
  );

  return (
    <AppLayout>
      <div data-tour="dashboard" className="space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#166534' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#19382D', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Planetary Surveillance Active
              </span>
              <span style={{ color: '#CCD4CD' }}>·</span>
              <span style={{ fontSize: '12px', color: '#5A6E63', fontFamily: 'monospace' }}>
                Mayawana Peat Buffer (-0.9246°S, 109.9414°E)
              </span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#19382D', margin: 0 }}>
              Good {greeting}, {user?.full_name?.split(' ')[0] || 'Officer'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#5A6E63', margin: '4px 0 0 0' }}>
              Environmental intelligence &amp; multi-sensor remote sensing workspace
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link 
              href="/projects/new?template=mayawana" 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.45rem 0.85rem',
                borderRadius: 6,
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#FFFFFF',
                color: '#19382D',
                border: '1px solid #DCE3DD',
                textDecoration: 'none',
              }}
            >
              <Sparkles size={14} style={{ color: '#78917C' }} />
              <span>Use Real Template</span>
            </Link>

            <Link 
              href="/projects/new" 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.45rem 0.95rem',
                borderRadius: 6,
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#19382D', /* Deep Forest */
                color: '#FFFFFF',
                border: '1px solid #19382D',
                textDecoration: 'none',
                boxShadow: '0 1px 3px rgba(25, 56, 45, 0.15)',
              }}
            >
              <Plus size={14} />
              <span>New Project</span>
            </Link>
          </div>
        </div>

        {/* ── Featured Canonical Reference Investigation: Mayawana ── */}
        <div 
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #DCE3DD',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 2px 6px rgba(25, 56, 45, 0.05)',
          }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    backgroundColor: '#EBEAE0',
                    color: '#19382D',
                  }}
                >
                  <Sparkles size={13} style={{ color: '#78917C' }} />
                  Canonical Planetary Audit Case
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', padding: '2px 6px', borderRadius: 4, backgroundColor: '#F4F3EC', color: '#5A6E63' }}>
                  Ketapang Regency, West Kalimantan, Borneo
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: '#EBF3ED', color: '#166534' }}>
                  12 Observation Epochs (2021 – 2024)
                </span>
              </div>

              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#19382D', margin: 0 }}>
                  PT Mayawana Persada Industrial Concession &mdash; West Kalimantan Audit
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#5A6E63', lineHeight: 1.5, margin: '6px 0 0 0' }}>
                  Multi-sensor investigation verifying 14,280 ha of documented peatland clearing. Corroborated across 12 quarters by Copernicus Sentinel-2 surface reflectance (NDVI 0.82 → 0.44), Hansen Global Forest Change, and NASA FIRMS thermal anomaly alerts.
                </p>
              </div>

              {/* Multi-Sensor Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: 8, backgroundColor: '#F4F3EC', border: '1px solid #DCE3DD' }}>
                  <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#5A6E63', fontWeight: 600 }}>Core Disturbance</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#DC2626' }}>18.4 ha</span>
                </div>
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: 8, backgroundColor: '#F4F3EC', border: '1px solid #DCE3DD' }}>
                  <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#5A6E63', fontWeight: 600 }}>Regional Peat Loss</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#D97706' }}>14,280 ha</span>
                </div>
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: 8, backgroundColor: '#F4F3EC', border: '1px solid #DCE3DD' }}>
                  <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#5A6E63', fontWeight: 600 }}>Canopy NDVI Drop</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#19382D' }}>-0.38 (48%)</span>
                </div>
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: 8, backgroundColor: '#F4F3EC', border: '1px solid #DCE3DD' }}>
                  <span style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#5A6E63', fontWeight: 600 }}>Hansen GFC Loss</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: '#166534' }}>Corroborated</span>
                </div>
              </div>
            </div>

            {/* Action Hub */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 lg:min-w-[200px]">
              <Link
                href={mayawana ? `/projects/${mayawana.id}` : '/projects'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '0.55rem 1rem',
                  borderRadius: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#19382D', /* Deep Forest */
                  color: '#FFFFFF',
                  textDecoration: 'none',
                }}
              >
                <FileText size={14} />
                <span>Open FER Dossier</span>
              </Link>
              <Link
                href="/map"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '0.55rem 1rem',
                  borderRadius: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  color: '#19382D',
                  border: '1px solid #DCE3DD',
                  textDecoration: 'none',
                }}
              >
                <Map size={14} style={{ color: '#78917C' }} />
                <span>Side-by-Side Map</span>
              </Link>
              <Link
                href="/shadow-footprint"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '0.55rem 1rem',
                  borderRadius: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  color: '#19382D',
                  border: '1px solid #DCE3DD',
                  textDecoration: 'none',
                }}
              >
                <Layers size={14} style={{ color: '#78917C' }} />
                <span>Zone B Radial Audit</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Projects', value: projects.length, icon: FolderOpen, href: '/projects' },
            { label: 'Automated Monitors', value: activeWatchers, icon: Eye, href: '/watchtower' },
            { label: 'High-Risk Cases', value: openCases || 1, icon: AlertTriangle, href: '/projects' },
            { label: 'Active Watch Plans', value: watchPlans.length, icon: Activity, href: '/watchtower' },
          ].map(({ label, value, icon: Icon, href }) => (
            <Link 
              key={label} 
              href={href} 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.25rem',
                backgroundColor: '#FFFFFF',
                border: '1px solid #DCE3DD',
                borderRadius: '10px',
                textDecoration: 'none',
                boxShadow: '0 2px 5px rgba(25, 56, 45, 0.04)',
                transition: 'all 150ms ease',
              }}
            >
              <div 
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: '#F4F3EC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#19382D',
                }}
              >
                <Icon size={20} />
              </div>
              <div>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#19382D', margin: 0, lineHeight: 1.2 }}>
                  {loading ? '—' : value}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#5A6E63', margin: '2px 0 0 0' }}>
                  {label}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Projects Dossier Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div 
            className="lg:col-span-2"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #DCE3DD',
              borderRadius: '10px',
              padding: '1.25rem 1.5rem',
              boxShadow: '0 2px 5px rgba(25, 56, 45, 0.04)',
            }}
          >
            <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid #EBEAE0' }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#19382D', margin: 0 }}>
                  Concession Dossiers &amp; Reports
                </h2>
                <p style={{ fontSize: '0.75rem', color: '#5A6E63', margin: '2px 0 0 0' }}>
                  Active environmental reviews and screening records
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link 
                  href="/projects" 
                  style={{ fontSize: '12px', fontWeight: 600, color: '#78917C', textDecoration: 'none' }}
                >
                  View All ({projects.length})
                </Link>
                <Link 
                  href="/projects/new" 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: '#19382D',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                  }}
                >
                  <Plus size={11} /> New
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="Create your first project or launch the Mayawana reference template."
                action={
                  <Link href="/projects/new?template=mayawana" className="btn-primary text-sm">
                    <Sparkles size={14} /> Load Mayawana Template
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {projects.slice(0, 6).map((p, idx) => {
                  const pName = p.project_name || p.title || 'Untitled Project';
                  const isRef = p.id === 'demo-mayawana-ketapang-west-kalimantan-002' || pName.includes('Mayawana');
                  const pLocation = [p.district, p.state, p.country].filter(Boolean).join(', ') || 'Location pending';

                  return (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      {...(idx === 0 ? { 'data-tour': 'fer-report' } : {})}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: 8,
                        border: '1px solid #DCE3DD',
                        backgroundColor: isRef ? '#F4F3EC' : '#FFFFFF',
                        textDecoration: 'none',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <div 
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          backgroundColor: isRef ? '#EBEAE0' : '#F4F3EC',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#19382D',
                          flexShrink: 0,
                        }}
                      >
                        <Leaf size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#19382D', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {pName}
                          </p>
                          {isRef && (
                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: 3, backgroundColor: '#EBEAE0', color: '#19382D' }}>
                              FLAGSHIP CASE
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '11px', color: '#5A6E63', marginTop: 2 }}>
                          <span>{pLocation}</span>
                          <span>·</span>
                          <span style={{ textTransform: 'capitalize' }}>{p.status || 'Active'}</span>
                        </div>
                      </div>
                      <ArrowRight size={14} style={{ color: '#78917C' }} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Guidance Panel */}
          <div 
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #DCE3DD',
              borderRadius: '10px',
              padding: '1.25rem 1.5rem',
              boxShadow: '0 2px 5px rgba(25, 56, 45, 0.04)',
            }}
          >
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#19382D', margin: 0, marginBottom: '0.5rem' }}>
              Autonomous Watchtower Feeds
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#5A6E63', margin: 0, marginBottom: '1rem', lineHeight: 1.4 }}>
              Active STAC spatial surveillance and automated detection triggers.
            </p>
            <div className="space-y-3 text-xs">
              <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: '#F4F3EC', border: '1px solid #DCE3DD' }}>
                <span style={{ display: 'block', fontWeight: 600, color: '#19382D', marginBottom: 2 }}>
                  Copernicus Sentinel-2 SR
                </span>
                <span style={{ color: '#5A6E63' }}>
                  Weekly 10-meter optical surface reflectance composites.
                </span>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: '#F4F3EC', border: '1px solid #DCE3DD' }}>
                <span style={{ display: 'block', fontWeight: 600, color: '#19382D', marginBottom: 2 }}>
                  Hansen Global Forest Change
                </span>
                <span style={{ color: '#5A6E63' }}>
                  UMD annual tree canopy loss benchmark dataset.
                </span>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: 8, backgroundColor: '#F4F3EC', border: '1px solid #DCE3DD' }}>
                <span style={{ display: 'block', fontWeight: 600, color: '#19382D', marginBottom: 2 }}>
                  NASA FIRMS Thermal
                </span>
                <span style={{ color: '#5A6E63' }}>
                  Near-real-time fire anomaly points (MODIS &amp; VIIRS).
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
