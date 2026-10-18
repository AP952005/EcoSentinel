'use client';
import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { projectsAPI, findingsAPI } from '@/lib/api';
import { ModeBadge, LoadingSpinner, EmptyState } from '@/components/ui/StatusBadges';
import { Avatar } from '@/components/ui/Avatar';
import {
  Leaf, Map, AlertTriangle, FileText, Shield, ChevronRight,
  RefreshCw, Download, Clock, Search, Eye
} from 'lucide-react';
import Link from 'next/link';

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>}>
      <ProjectDetailContent />
    </Suspense>
  );
}

function ProjectDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as 'summary' | 'findings' | 'map' | 'evidence' | null;
  const [project, setProject] = useState<any>(null);
  const [fers, setFers] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [boundaries, setBoundaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingFER, setGeneratingFER] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'findings' | 'map' | 'evidence'>(initialTab || 'summary');

  useEffect(() => {
    const tabParam = searchParams.get('tab') as 'summary' | 'findings' | 'map' | 'evidence' | null;
    if (tabParam && ['summary', 'findings', 'map', 'evidence'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      projectsAPI.get(id).then(r => setProject(r.data)),
      projectsAPI.listFERs(id).then(r => setFers(r.data)),
      projectsAPI.listFindings(id).then(r => setFindings(r.data)),
      projectsAPI.listBoundaries(id).then(r => setBoundaries(r.data)),
    ]).finally(() => setLoading(false));
  }, [id]);

  const latestFer = fers[0];

  async function regenerateFER() {
    setGeneratingFER(true);
    try {
      await projectsAPI.generateFER(id);
      const r = await projectsAPI.listFERs(id);
      setFers(r.data);
      const fr = await projectsAPI.listFindings(id);
      setFindings(fr.data);
    } finally {
      setGeneratingFER(false);
    }
  }

  async function exportFER() {
    if (!latestFer) return;
    try {
      const { ferAPI } = await import('@/lib/api');
      const response = await ferAPI.exportPdf(latestFer.id);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const safeName = (project?.project_name || project?.name || 'Project').replace(/[^a-zA-Z0-9]/g, '_');
      const a = document.createElement('a');
      a.href = url;
      a.download = `FER_${safeName}_v${latestFer.version}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('PDF export failed, falling back to JSON export', e);
      const { ferAPI } = await import('@/lib/api');
      const r = await ferAPI.export(latestFer.id);
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FER_${id}_v${latestFer.version}.json`;
      a.click();
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <EmptyState title="Project not found" description="This project does not exist or you do not have access." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div data-tour="fer-report" className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 flex items-center justify-center flex-shrink-0">
              <Leaf size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-100">{project.project_name}</h1>
                <ModeBadge mode={project.analysis_mode} />
              </div>
              <p className="text-sm text-slate-400">
                {project.sector} · {[project.district, project.state, project.country].filter(Boolean).join(', ') || 'Global'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Applicant: {project.applicant_name} {project.organization && `· ${project.organization}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={regenerateFER} className="btn-secondary text-sm" disabled={generatingFER}>
              {generatingFER ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />}
              {generatingFER ? 'Generating…' : 'New FER'}
            </button>
            {latestFer && (
              <button onClick={exportFER} className="btn-secondary text-sm">
                <Download size={14} /> Export
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-800">
          {(['summary', 'findings', 'map', 'evidence'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'summary' ? 'FER Summary' : tab === 'map' ? 'Map & Zones' : 
               tab === 'findings' ? `Findings (${findings.length})` : 'Evidence Gaps'}
            </button>
          ))}
        </div>

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {generatingFER && (
                <div className="eco-card p-6 flex items-center gap-4 bg-teal-900/20 border-teal-500/30">
                  <Avatar state="processing" size={60} />
                  <div>
                    <p className="font-medium text-teal-300">Generating First Environmental Report…</p>
                    <p className="text-sm text-teal-400/70">Assembling project context, analysis and evidence gaps.</p>
                  </div>
                </div>
              )}

              {!latestFer && !generatingFER ? (
                <div className="eco-card p-8 text-center">
                  <Avatar state="idle" size={80} className="mx-auto mb-4" />
                  <p className="text-slate-300 font-medium mb-2">No FER generated yet</p>
                  <button onClick={regenerateFER} className="btn-primary">
                    <Leaf size={16} /> Generate FER
                  </button>
                </div>
              ) : latestFer && (
                <>
                  {/* FER Header */}
                  <div className="eco-card p-6 border-l-4 border-teal-500">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-teal-400" />
                        <span className="text-sm font-semibold text-teal-400">
                          First Environmental Report — Version {latestFer.version}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ModeBadge mode={latestFer.report_mode} />
                        <span className="text-xs text-slate-500">
                          {new Date(latestFer.created_at).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </div>
                    {latestFer.summary && (
                      <p className="text-sm text-slate-300 leading-relaxed">{latestFer.summary}</p>
                    )}
                  </div>

                  {/* Executive summary */}
                  {latestFer.executive_summary && (
                    <div className="eco-card p-6">
                      <h3 className="font-semibold text-slate-200 mb-3">Executive Summary</h3>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                        {latestFer.executive_summary}
                      </p>
                    </div>
                  )}

                  {/* Screening observations */}
                  {latestFer.screening_observations?.length > 0 && (
                    <div className="eco-card p-6">
                      <h3 className="font-semibold text-slate-200 mb-4">Screening Observations</h3>
                      <div className="space-y-3">
                        {latestFer.screening_observations.map((obs: any, i: number) => (
                          <div key={i} className="flex gap-3 p-3 rounded-lg bg-slate-800/40">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                            <div>
                              <p className="text-sm text-slate-200">{obs.description}</p>
                              {obs.source && (
                                <p className="text-xs text-slate-500 mt-1">Source: {obs.source}</p>
                              )}
                              {obs.connection_mode && <ModeBadge mode={obs.connection_mode} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Investigation guide */}
                  {latestFer.investigation_guide?.length > 0 && (
                    <div className="eco-card p-6" data-tour="fer-evidence">
                      <h3 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
                        <Search size={16} className="text-blue-400" /> Officer Investigation Guide
                      </h3>
                      <ul className="space-y-2">
                        {latestFer.investigation_guide.map((q: string, i: number) => (
                          <li key={i} className="flex gap-2 text-sm text-slate-300">
                            <span className="text-teal-400 font-medium flex-shrink-0">{i + 1}.</span>
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Limitations */}
                  {latestFer.limitations?.length > 0 && (
                    <div className="eco-card p-4 border-amber-500/30 bg-amber-500/5">
                      <h3 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-1">
                        <AlertTriangle size={14} /> Important Limitations
                      </h3>
                      <ul className="space-y-1">
                        {latestFer.limitations.map((l: string, i: number) => (
                          <li key={i} className="text-xs text-amber-200/80 flex gap-2">
                            <span>·</span>{l}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Project info card */}
              <div className="eco-card p-5" data-tour="case-history">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Project Details &amp; History</h3>
                <div className="space-y-2 text-xs">
                  {[
                    ['Sector', project.sector],
                    ['Stage', project.application_stage || '—'],
                    ['Category', project.project_category || '—'],
                    ['EIA Category', project.eia_category || '—'],
                    ['Land area', project.scale_data?.land_area_ha ? `${project.scale_data.land_area_ha} ha` : '—'],
                    ['Coordinates', project.latitude ? `${project.latitude}°N ${project.longitude}°E` : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-slate-500 w-24 flex-shrink-0">{k}</span>
                      <span className="text-slate-300">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="eco-card p-5 space-y-2">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Quick Actions</h3>
                <Link href="/map" className="btn-secondary w-full justify-start text-xs">
                  <Map size={13} /> View on Map
                </Link>
                <Link href="/shadow-footprint" className="btn-secondary w-full justify-start text-xs">
                  <Search size={13} /> Shadow Footprint
                </Link>
                <Link href="/watchtower" className="btn-secondary w-full justify-start text-xs">
                  <Eye size={13} /> Watchtower
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Findings Tab */}
        {activeTab === 'findings' && (
          <div className="space-y-4" data-tour="challenge-finding">
            {findings.length === 0 ? (
              <EmptyState
                title="No findings yet"
                description="Generate a FER to produce candidate findings from the analysis."
              />
            ) : (
              findings.map(f => (
                <FindingCard key={f.id} finding={f} />
              ))
            )}
          </div>
        )}

        {/* Map Tab */}
        {activeTab === 'map' && (
          <div className="eco-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-200">Project Map & Zones</h3>
              <Link href="/map" className="btn-secondary text-sm"><Map size={14} /> Open full map</Link>
            </div>
            <div className="bg-slate-800 rounded-lg h-64 flex items-center justify-center">
              <div className="text-center">
                <Map size={32} className="text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">
                  {project.latitude
                    ? `Project centroid: ${project.latitude}°N, ${project.longitude}°E`
                    : 'No coordinates provided'}
                </p>
                <Link href="/map" className="btn-primary mt-3 text-sm">Open map view</Link>
              </div>
            </div>
          </div>
        )}

        {/* Evidence Tab */}
        {activeTab === 'evidence' && latestFer && (
          <div className="space-y-4">
            {latestFer.evidence_gaps?.length > 0 && (
              <div className="eco-card p-6">
                <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-400" /> Evidence Gaps
                </h3>
                <ul className="space-y-2">
                  {latestFer.evidence_gaps.map((g: string, i: number) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-300">
                      <span className="text-amber-400/60">△</span> {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {latestFer.source_references?.length > 0 && (
              <div className="eco-card p-6">
                <h3 className="font-semibold text-slate-200 mb-3">Source References</h3>
                {latestFer.source_references.map((src: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded text-xs">
                    <ModeBadge mode={src.connection_mode || 'REPLAY'} />
                    <span className="text-slate-300">{src.name}</span>
                    {src.url && <a href={src.url} target="_blank" className="text-teal-400 hover:underline">↗</a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function FindingCard({ finding }: { finding: any }) {
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<any>(null);

  async function runChallenge() {
    setLoading(true);
    try {
      const r = await findingsAPI.challenge(finding.id);
      setChallenge(r.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="eco-card p-6 border-l-4 border-amber-500">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-amber-400" />
            <span className="font-medium text-slate-200 text-sm">{finding.title}</span>
            <ModeBadge mode={finding.connection_mode} />
          </div>
          <p className="text-xs text-slate-400">{finding.description}</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex-shrink-0">
          {finding.status?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Metrics */}
      {finding.candidate_area_ha && (
        <div className="grid grid-cols-3 gap-3 my-3">
          {[
            ['Candidate area', `${finding.candidate_area_ha} ha`],
            ['NDVI delta', finding.ndvi_delta?.toFixed(3)],
            ['Zone', finding.zone_classification?.replace(/_/g, ' ') || '—'],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-800/50 rounded p-2 text-center">
              <p className="text-xs text-slate-500">{k}</p>
              <p className="text-sm font-medium text-slate-200">{v || '—'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Challenge result */}
      {challenge && (
        <div className="mt-4 p-4 rounded-lg bg-slate-800/60 border border-slate-700 space-y-3 text-sm">
          <p className="font-medium text-teal-400 flex items-center gap-2">
            <Shield size={14} /> Challenge Analysis
          </p>
          <p className="text-slate-300 text-xs">{challenge.observation_summary}</p>
          {challenge.recommended_review_action && (
            <p className="text-xs text-slate-400">
              <strong className="text-slate-300">Recommended action:</strong> {challenge.recommended_review_action}
            </p>
          )}
          {challenge.alternative_explanations?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Alternative explanations:</p>
              <ul className="space-y-1">
                {challenge.alternative_explanations.map((e: string, i: number) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-1">· {e}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-slate-600 mt-2">
            Generated by: {challenge.generated_by_model}
          </p>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={runChallenge} disabled={loading} className="btn-secondary text-xs">
          {loading ? <LoadingSpinner size={13} /> : <Search size={13} />}
          {loading ? 'Analysing…' : 'Challenge This Finding'}
        </button>
      </div>
    </div>
  );
}
