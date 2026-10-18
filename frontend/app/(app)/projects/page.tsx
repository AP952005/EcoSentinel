'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { projectsAPI } from '@/lib/api';
import { ModeBadge, RiskBadge, LoadingSpinner, EmptyState } from '@/components/ui/StatusBadges';
import { 
  FolderGit2, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  MapPin, 
  FileText, 
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Building2,
  RefreshCw,
  Sparkles,
  Map,
  Layers
} from 'lucide-react';

interface Project {
  id: string;
  project_name?: string;
  title?: string;
  applicant_name?: string;
  sector?: string;
  category?: string;
  state?: string;
  district?: string;
  country?: string;
  status: string;
  analysis_mode?: string;
  is_replay?: boolean;
  latitude?: number;
  longitude?: number;
  created_at: string;
  scale_data?: any;
}

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sectorFilter, setSectorFilter] = useState('ALL');

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await projectsAPI.list();
      setProjects(res.data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const getTitle = (p: Project) => p.project_name || p.title || 'Untitled Investigation';
  const getSector = (p: Project) => p.sector || p.category || 'General Assessment';
  const getLocation = (p: Project) => {
    const parts = [p.district, p.state, p.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Location pending';
  };

  const mayawanaProject = projects.find(
    (p) => p.id === 'demo-mayawana-ketapang-west-kalimantan-002' || getTitle(p).includes('Mayawana')
  );

  const filteredProjects = projects.filter((p) => {
    const title = getTitle(p).toLowerCase();
    const applicant = (p.applicant_name || '').toLowerCase();
    const location = getLocation(p).toLowerCase();
    const q = search.toLowerCase();

    const matchesSearch = title.includes(q) || applicant.includes(q) || location.includes(q);
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchesSector = sectorFilter === 'ALL' || getSector(p) === sectorFilter;

    return matchesSearch && matchesStatus && matchesSector;
  });

  const sectors = Array.from(new Set(projects.map(getSector).filter(Boolean)));

  const totalCount = projects.length;
  const inReviewCount = projects.filter((p) => p.status === 'under_review' || p.status === 'active' || p.status === 'fer_in_progress').length;
  const flaggedCount = projects.filter((p) => p.status === 'flagged' || p.status === 'action_required' || getTitle(p).includes('Mayawana')).length;
  const completedCount = projects.filter((p) => p.status === 'approved' || p.status === 'cleared').length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider text-teal-400 font-semibold">Regulatory Concession Registry</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20">
                12-Epoch Planetary Radar
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Environmental Projects &amp; Investigation Dossiers</h1>
            <p className="text-sm text-slate-400 mt-1">
              Official planetary compliance screening, Fast Environmental Reviews (FER), and multi-spectral audit records.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/projects/new"
              className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shadow-lg shadow-teal-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              New Project Intake
            </Link>
            <button
              onClick={fetchProjects}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
              title="Refresh project list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Featured Canonical Reference Investigation: Mayawana */}
        {mayawanaProject && (
          <div 
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #DCE3DD',
              borderRadius: '10px',
              padding: '1.5rem',
              boxShadow: '0 2px 5px rgba(25, 56, 45, 0.05)',
            }}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span 
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#EBEAE0',
                      color: '#19382D',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Sparkles size={12} style={{ color: '#78917C' }} />
                    CANONICAL PLANETARY AUDIT CASE
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#5A6E63' }}>
                    Ketapang Regency, West Kalimantan (-0.9246°S, 109.9414°E)
                  </span>
                  <ModeBadge mode={mayawanaProject.analysis_mode || 'REPLAY'} />
                </div>

                <div>
                  <h2 
                    style={{
                      fontSize: '1.35rem',
                      fontWeight: 700,
                      color: '#19382D',
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {getTitle(mayawanaProject)}
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: '#5A6E63', margin: '6px 0 0 0', lineHeight: 1.5 }}>
                    PT Mayawana Persada (Alas Kusuma Group) concession audit in Ketapang Regency, West Kalimantan. 
                    Verified 18.4 ha core tropical canopy loss and 20.0 ha buffer degradation corroborated by Hansen 2022 annual forest loss and Sentinel-2 BOA reflectance (NDVI 0.82 → 0.44).
                  </p>
                </div>

                {/* Corroboration Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  <div style={{ backgroundColor: '#F4F3EC', border: '1px solid #EBEAE0', borderRadius: 8, padding: '10px 12px' }}>
                    <span style={{ fontSize: '10px', color: '#5A6E63', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', fontWeight: 600 }}>Core Loss</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#DC2626' }}>18.4 ha</span>
                  </div>
                  <div style={{ backgroundColor: '#F4F3EC', border: '1px solid #EBEAE0', borderRadius: 8, padding: '10px 12px' }}>
                    <span style={{ fontSize: '10px', color: '#5A6E63', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', fontWeight: 600 }}>Regional Loss</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#D97706' }}>14,280 ha</span>
                  </div>
                  <div style={{ backgroundColor: '#F4F3EC', border: '1px solid #EBEAE0', borderRadius: 8, padding: '10px 12px' }}>
                    <span style={{ fontSize: '10px', color: '#5A6E63', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', fontWeight: 600 }}>NDVI Delta</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#19382D' }}>-0.38 (-48%)</span>
                  </div>
                  <div style={{ backgroundColor: '#F4F3EC', border: '1px solid #EBEAE0', borderRadius: 8, padding: '10px 12px' }}>
                    <span style={{ fontSize: '10px', color: '#5A6E63', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', fontWeight: 600 }}>Hansen GFC Loss</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#166534' }}>Corroborated</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-2 lg:min-w-[190px] shrink-0">
                <Link
                  href={`/projects/${mayawanaProject.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '0.55rem 1rem',
                    borderRadius: 6,
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: '#19382D',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    boxShadow: '0 1px 3px rgba(25, 56, 45, 0.15)',
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
                    border: '1px solid #CCD4CD',
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
                    border: '1px solid #CCD4CD',
                    textDecoration: 'none',
                  }}
                >
                  <Layers size={14} style={{ color: '#78917C' }} />
                  <span>Zone B Radial Audit</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Quick KPI Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="eco-card p-4">
            <div className="flex items-center justify-between text-xs font-semibold" style={{ color: '#5A6E63' }}>
              <span>Total Dossiers</span>
              <FolderGit2 className="w-4 h-4" style={{ color: '#78917C' }} />
            </div>
            <div className="text-2xl font-bold mt-2" style={{ color: '#19382D' }}>{totalCount}</div>
            <div className="text-xs mt-0.5" style={{ color: '#83948B' }}>Recorded concession projects</div>
          </div>

          <div className="eco-card p-4">
            <div className="flex items-center justify-between text-xs font-semibold" style={{ color: '#5A6E63' }}>
              <span>Active Screening</span>
              <RefreshCw className="w-4 h-4" style={{ color: '#78917C' }} />
            </div>
            <div className="text-2xl font-bold mt-2" style={{ color: '#19382D' }}>{inReviewCount}</div>
            <div className="text-xs mt-0.5" style={{ color: '#83948B' }}>Satellite passes running</div>
          </div>

          <div className="eco-card p-4">
            <div className="flex items-center justify-between text-xs font-semibold" style={{ color: '#5A6E63' }}>
              <span>Flagged High-Risk</span>
              <AlertTriangle className="w-4 h-4" style={{ color: '#DC2626' }} />
            </div>
            <div className="text-2xl font-bold mt-2" style={{ color: '#DC2626' }}>{flaggedCount}</div>
            <div className="text-xs mt-0.5" style={{ color: '#83948B' }}>Vegetation drop &gt; -0.15</div>
          </div>

          <div className="eco-card p-4">
            <div className="flex items-center justify-between text-xs font-semibold" style={{ color: '#5A6E63' }}>
              <span>Approved / Cleared</span>
              <ShieldCheck className="w-4 h-4" style={{ color: '#166534' }} />
            </div>
            <div className="text-2xl font-bold mt-2" style={{ color: '#166534' }}>{completedCount}</div>
            <div className="text-xs mt-0.5" style={{ color: '#83948B' }}>Compliant boundaries</div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="eco-card p-4 border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by project name, applicant, district, or state..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="eco-input pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="eco-select text-xs py-1.5 px-2.5 w-auto"
            >
              <option value="ALL">All Statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="under_review">Under Review</option>
              <option value="flagged">Flagged</option>
              <option value="approved">Approved</option>
            </select>

            {sectors.length > 0 && (
              <>
                <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0 ml-2">
                  <span>Sector:</span>
                </div>
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="eco-select text-xs py-1.5 px-2.5 w-auto"
                >
                  <option value="ALL">All Sectors</option>
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Projects List */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <LoadingSpinner size={32} />
            <p className="text-xs text-slate-400 mt-3">Loading projects repository...</p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <EmptyState
            title="No projects found"
            description={
              search || statusFilter !== 'ALL' || sectorFilter !== 'ALL'
                ? "No projects matched your search criteria. Try clearing some filters."
                : "No environmental projects recorded yet. Create your first project to trigger FER generation."
            }
            actionLabel="Create New Project"
            actionHref="/projects/new"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #DCE3DD',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(25, 56, 45, 0.05)',
                  transition: 'all 150ms ease',
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span 
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#166534',
                        backgroundColor: '#EBEAE0',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {getSector(project)}
                    </span>
                    <ModeBadge mode={project.analysis_mode || 'REPLAY'} />
                  </div>

                  <h3 
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: '#19382D',
                      margin: '4px 0 0 0',
                      lineHeight: 1.35,
                    }}
                  >
                    {getTitle(project)}
                  </h3>

                  {project.applicant_name && (
                    <div className="flex items-center gap-1.5 text-xs mt-1.5" style={{ color: '#5A6E63' }}>
                      <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#78917C' }} />
                      <span className="truncate">{project.applicant_name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs mt-1.5" style={{ color: '#5A6E63' }}>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: '#78917C' }} />
                      <span className="truncate">{getLocation(project)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '1px solid #EBEAE0' }}>
                    <span className="text-xs font-medium" style={{ color: '#5A6E63' }}>Risk Profile:</span>
                    <RiskBadge
                      level={
                        project.status === 'flagged' || getTitle(project).includes('Mayawana')
                          ? 'HIGH'
                          : project.status === 'under_review' || project.status === 'active'
                          ? 'MEDIUM'
                          : 'LOW'
                      }
                      label={
                        getTitle(project).includes('Mayawana') 
                          ? 'HIGH AUDIT RISK' 
                          : project.status.replace('_', ' ').toUpperCase()
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 flex items-center justify-between text-xs" style={{ borderTop: '1px solid #EBEAE0' }}>
                  <div className="flex items-center gap-1 text-[11px]" style={{ color: '#83948B' }}>
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                  <Link
                    href={`/projects/${project.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#19382D',
                      textDecoration: 'none',
                    }}
                  >
                    <span>View Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" style={{ color: '#78917C' }} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
