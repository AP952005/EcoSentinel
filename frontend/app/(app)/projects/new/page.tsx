'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { projectsAPI } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner } from '@/components/ui/StatusBadges';
import { ChevronRight, ChevronLeft, Leaf, AlertCircle, Sparkles, CheckCircle2, MapPin } from 'lucide-react';

const SECTORS = [
  'Mining', 'Infrastructure', 'Industry', 'Thermal Power',
  'River Valley & Hydroelectric', 'Nuclear Power',
  'Tourism', 'Construction', 'Coastal Regulation Zone',
  'Forestry', 'Waste Management', 'Other',
];

const APPLICATION_STAGES = [
  'Compliance Audit & Concession Verification',
  'Scoping / ToR', 'EIA study in progress', 
  'EIA submitted for appraisal', 'Appraisal in progress',
  'EC granted', 'EC conditions compliance monitoring', 'Other',
];

const PROJECT_CATEGORIES = ['New Project', 'Expansion / Modernization', 'Change of Product', 'Other'];

type Step = 'A' | 'B' | 'C' | 'D' | 'submit';
const STEPS: Step[] = ['A', 'B', 'C', 'D', 'submit'];
const STEP_LABELS: Record<Step, string> = {
  A: 'Application Context', B: 'Project Identity',
  C: 'Scale & Scope', D: 'Location', submit: 'Review & Submit',
};

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><LoadingSpinner size={36} /></div>}>
      <NewProjectContent />
    </Suspense>
  );
}

function NewProjectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>('A');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templateLoaded, setTemplateLoaded] = useState(false);

  const [form, setForm] = useState({
    // A
    application_stage: '', project_category: 'New Project',
    proposal_number: '', has_prior_approval: false, prior_approval_reference: '',
    // B
    project_name: '', applicant_name: '', organization: '', sector: '',
    activity: '', eia_category: '', project_summary: '',
    // C
    scale_data: { capital_cost_crores: '', capacity_value: '', capacity_unit: 'm3/year',
      land_area_ha: '', project_length_km: '' },
    // D
    country: 'Indonesia', state: '', district: '', sub_district: '',
    village: '', survey_details: '', latitude: '', longitude: '', location_description: '',
  });

  function loadMayawanaTemplate() {
    setForm({
      application_stage: 'Compliance Audit & Concession Verification',
      project_category: 'New Project',
      proposal_number: 'WK-KLHK-2024-00918',
      has_prior_approval: true,
      prior_approval_reference: 'SK.732/Menhut-II/2010 (IUPHHK-HTI Concession Decree)',
      project_name: 'Mayawana Forest-Change & Peatland Concession Audit',
      applicant_name: 'PT Mayawana Persada (Alas Kusuma Group)',
      organization: 'PT Mayawana Persada',
      sector: 'Forestry',
      activity: 'Industrial Timber Plantation (HTI) & Peatland Buffer Management',
      eia_category: 'Category A (High Sensitivity Tropical Peatland)',
      project_summary: (
        'Authoritative multi-temporal environmental intelligence investigation and remote-sensing ' +
        'compliance audit of the Mayawana commercial concession in Ketapang Regency, West Kalimantan, ' +
        'Borneo (-0.924587°S, 109.941413°E). Multi-sensor planetary screening verifies 18.4 ha of core ' +
        'tropical rainforest canopy disturbance and 20.0 ha of secondary buffer degradation across 12 observation ' +
        'epochs (March 2021 to July 2024). Corroborated by Copernicus Sentinel-2 L2A BOA reflectance ' +
        '(NDVI 0.82 → 0.44), Hansen Global Forest Change v1.11 (2022 annual loss epoch), and Dynamic World ' +
        'continuous probability transitions (+38% bare ground expansion).'
      ),
      scale_data: {
        capital_cost_crores: '450.00',
        capacity_value: '120000',
        capacity_unit: 'm3/year',
        land_area_ha: '11309.73',
        project_length_km: '12.5',
      },
      country: 'Indonesia',
      state: 'West Kalimantan',
      district: 'Ketapang Regency',
      sub_district: 'Simpang Dua / Sandai',
      village: 'Keriau Peatland Corridor',
      survey_details: 'Hansen GFC 2022 Loss Tile 00N_100E · Sentinel-2 Tile 49MDN · Centroid -0.924587, 109.941413',
      latitude: '-0.924587',
      longitude: '109.941413',
      location_description: 'Mayawana Plantation concession boundary, adjacent to Bukit Baka Bukit Raya biodiversity corridor and high-carbon peat dome in Ketapang Regency.',
    });
    setTemplateLoaded(true);
  }

  // Auto-fill template if query parameter is set
  useEffect(() => {
    if (searchParams.get('template') === 'mayawana') {
      loadMayawanaTemplate();
    }
  }, [searchParams]);

  function update(key: string, val: any) {
    setForm(f => ({ ...f, [key]: val }));
  }
  function updateScale(key: string, val: any) {
    setForm(f => ({ ...f, scale_data: { ...f.scale_data, [key]: val } }));
  }

  function next() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }
  function prev() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      const payload = {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        scale_data: {
          capital_cost_crores: form.scale_data.capital_cost_crores ? parseFloat(form.scale_data.capital_cost_crores) : null,
          capacity_value: form.scale_data.capacity_value ? parseFloat(form.scale_data.capacity_value) : null,
          capacity_unit: form.scale_data.capacity_unit,
          land_area_ha: form.scale_data.land_area_ha ? parseFloat(form.scale_data.land_area_ha) : null,
          project_length_km: form.scale_data.project_length_km ? parseFloat(form.scale_data.project_length_km) : null,
        },
      };
      const r = await projectsAPI.create(payload);
      const projectId = r.data.id;
      // Auto-generate FER
      await projectsAPI.generateFER(projectId);
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      setError(Array.isArray(d) ? d.map((x: any) => x.msg).join(', ') : d || 'Submission failed');
      setLoading(false);
    }
  }

  const stepIdx = STEPS.indexOf(step);

  return (
    <AppLayout>
      <div data-tour="fer-form" className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar state={loading ? 'processing' : 'idle'} size={65} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#19382D' }}>New Project &amp; FER Intake</h1>
              <p className="text-sm mt-0.5" style={{ color: '#5A6E63' }}>
                Register concession boundaries to trigger automated planetary Fast Environmental Review (FER).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadMayawanaTemplate}
            className="text-xs py-2 px-3 flex items-center gap-1.5 rounded-lg font-semibold shrink-0 transition-colors shadow-sm"
            style={{ background: '#E8F0EA', border: '1px solid #C4D7C8', color: '#19382D' }}
          >
            <Sparkles size={14} style={{ color: '#19382D' }} />
            Load Real Demonstration Template
          </button>
        </div>

        {/* Template Loaded Alert */}
        {templateLoaded && (
          <div className="p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs" style={{ background: '#E8F0EA', border: '1px solid #C4D7C8', color: '#19382D' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#19382D] shrink-0" />
              <span>
                <strong>Real Template Active:</strong> PT Mayawana Persada Concession (11,309.7 ha, Ketapang Regency, West Kalimantan -0.9246°S, 109.9414°E).
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStep('submit')}
              className="px-2.5 py-1 rounded font-bold shrink-0 transition-colors"
              style={{ background: '#19382D', color: '#F4F3EC' }}
            >
              Jump to Review &amp; Submit →
            </button>
          </div>
        )}

        {/* Progress Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => i <= stepIdx && setStep(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: s === step ? '#19382D' : i < stepIdx ? '#E8F0EA' : '#F4F3EC',
                  color: s === step ? '#F4F3EC' : i < stepIdx ? '#19382D' : '#78917C',
                  border: s === step ? '1px solid #19382D' : i < stepIdx ? '1px solid #C4D7C8' : '1px solid #DCE3DD',
                  fontWeight: s === step ? 700 : 600,
                  cursor: i <= stepIdx ? 'pointer' : 'default',
                }}
              >
                {STEP_LABELS[s]}
              </button>
              {i < STEPS.length - 1 && <ChevronRight size={12} style={{ color: '#78917C' }} />}
            </div>
          ))}
        </div>

        <div className="eco-card p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Section A */}
          {step === 'A' && (
            <div className="space-y-5 animate-fade-in-up">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-semibold text-slate-200">Section A — Application Context</h2>
                <p className="text-xs text-slate-400 mt-0.5">Specify the regulatory status and prior approval references.</p>
              </div>
              <div>
                <label className="eco-label">Application stage</label>
                <select className="eco-select" value={form.application_stage} onChange={e => update('application_stage', e.target.value)}>
                  <option value="">— Select if known —</option>
                  {APPLICATION_STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="eco-label">Project category</label>
                <select className="eco-select" value={form.project_category} onChange={e => update('project_category', e.target.value)}>
                  {PROJECT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="eco-label">Proposal / File number</label>
                <input className="eco-input" placeholder="e.g. WK-KLHK-2024-00918" value={form.proposal_number} onChange={e => update('proposal_number', e.target.value)} />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input type="checkbox" id="prior" checked={form.has_prior_approval} onChange={e => update('has_prior_approval', e.target.checked)} className="rounded" />
                <label htmlFor="prior" className="text-sm text-slate-300 cursor-pointer">Has prior environmental approval</label>
              </div>
              {form.has_prior_approval && (
                <div>
                  <label className="eco-label">Prior approval reference</label>
                  <input className="eco-input" placeholder="e.g. SK.732/Menhut-II/2010" value={form.prior_approval_reference} onChange={e => update('prior_approval_reference', e.target.value)} />
                </div>
              )}
            </div>
          )}

          {/* Section B */}
          {step === 'B' && (
            <div className="space-y-5 animate-fade-in-up">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-semibold text-slate-200">Section B — Project Identity</h2>
                <p className="text-xs text-slate-400 mt-0.5">Core identification of the project proponent and industrial sector.</p>
              </div>
              <div>
                <label className="eco-label">Project name <span className="text-red-400">*</span></label>
                <input className="eco-input" placeholder="e.g. Mayawana Forest-Change & Peatland Concession Audit" value={form.project_name} onChange={e => update('project_name', e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="eco-label">Applicant / Proponent name <span className="text-red-400">*</span></label>
                  <input className="eco-input" placeholder="e.g. PT Mayawana Persada (Alas Kusuma Group)" value={form.applicant_name} onChange={e => update('applicant_name', e.target.value)} required />
                </div>
                <div>
                  <label className="eco-label">Organization / Parent Company</label>
                  <input className="eco-input" placeholder="e.g. PT Mayawana Persada" value={form.organization} onChange={e => update('organization', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="eco-label">Sector <span className="text-red-400">*</span></label>
                  <select className="eco-select" value={form.sector} onChange={e => update('sector', e.target.value)} required>
                    <option value="">— Select sector —</option>
                    {SECTORS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="eco-label">Activity description</label>
                  <input className="eco-input" placeholder="e.g. Industrial Timber Plantation & Peat Drainage" value={form.activity} onChange={e => update('activity', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="eco-label">Environmental Sensitivity Category</label>
                <input className="eco-input" placeholder="e.g. Category A (High Sensitivity Peatland Corridor)" value={form.eia_category} onChange={e => update('eia_category', e.target.value)} />
              </div>
              <div>
                <label className="eco-label">Project summary</label>
                <textarea className="eco-input min-h-[90px]" placeholder="Brief narrative of the operational footprint..." value={form.project_summary} onChange={e => update('project_summary', e.target.value)} />
              </div>
            </div>
          )}

          {/* Section C */}
          {step === 'C' && (
            <div className="space-y-5 animate-fade-in-up">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-semibold text-slate-200">Section C — Scale &amp; Scope</h2>
                <p className="text-xs text-slate-400 mt-0.5">Physical dimensions, buffer zone area, and operational capacity.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="eco-label">Capital cost (₹ Crores / $ USD M)</label>
                  <input className="eco-input" type="number" placeholder="e.g. 450.00" value={form.scale_data.capital_cost_crores} onChange={e => updateScale('capital_cost_crores', e.target.value)} />
                </div>
                <div>
                  <label className="eco-label">Total Concession Area (ha)</label>
                  <input className="eco-input" type="number" placeholder="e.g. 11309.73" value={form.scale_data.land_area_ha} onChange={e => updateScale('land_area_ha', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="eco-label">Operational Capacity</label>
                  <input className="eco-input" type="number" placeholder="e.g. 120000" value={form.scale_data.capacity_value} onChange={e => updateScale('capacity_value', e.target.value)} />
                </div>
                <div>
                  <label className="eco-label">Unit</label>
                  <input className="eco-input" placeholder="e.g. m3/year" value={form.scale_data.capacity_unit} onChange={e => updateScale('capacity_unit', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="eco-label">Haulage / Access Corridor Length (km)</label>
                <input className="eco-input" type="number" placeholder="e.g. 12.5" value={form.scale_data.project_length_km} onChange={e => updateScale('project_length_km', e.target.value)} />
              </div>
            </div>
          )}

          {/* Section D */}
          {step === 'D' && (
            <div className="space-y-5 animate-fade-in-up">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-semibold text-slate-200">Section D — Geographic Coordinates &amp; Location</h2>
                <p className="text-xs text-slate-400 mt-0.5">Geospatial centroid for automated satellite STAC scene intersection.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="eco-label">Country</label>
                  <input className="eco-input" placeholder="e.g. Indonesia" value={form.country} onChange={e => update('country', e.target.value)} />
                </div>
                <div>
                  <label className="eco-label">Province / State</label>
                  <input className="eco-input" placeholder="e.g. West Kalimantan" value={form.state} onChange={e => update('state', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="eco-label">Regency / District</label>
                  <input className="eco-input" placeholder="e.g. Ketapang Regency" value={form.district} onChange={e => update('district', e.target.value)} />
                </div>
                <div>
                  <label className="eco-label">Sub-District / Sector</label>
                  <input className="eco-input" placeholder="e.g. Simpang Dua / Sandai" value={form.sub_district} onChange={e => update('sub_district', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="eco-label">Latitude (WGS-84 Decimal)</label>
                  <input className="eco-input font-mono" type="number" step="any" placeholder="e.g. -0.924587" value={form.latitude} onChange={e => update('latitude', e.target.value)} />
                </div>
                <div>
                  <label className="eco-label">Longitude (WGS-84 Decimal)</label>
                  <input className="eco-input font-mono" type="number" step="any" placeholder="e.g. 109.941413" value={form.longitude} onChange={e => update('longitude', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="eco-label">Location notes &amp; bio-corridor description</label>
                <textarea className="eco-input min-h-[80px]" placeholder="e.g. Peatland buffer adjacent to Bukit Baka Bukit Raya corridor..." value={form.location_description} onChange={e => update('location_description', e.target.value)} />
              </div>
            </div>
          )}

          {/* Review & Submit */}
          {step === 'submit' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="border-b pb-3" style={{ borderColor: '#DCE3DD' }}>
                <h2 className="text-lg font-bold" style={{ color: '#19382D' }}>Review &amp; Generate Preliminary Review</h2>
                <p className="text-xs mt-0.5" style={{ color: '#5A6E63' }}>Verify project details before triggering the automated satellite screening pipeline.</p>
              </div>

              <div className="space-y-2.5 p-5 rounded-xl" style={{ background: '#F4F3EC', border: '1px solid #DCE3DD' }}>
                <Row label="Project Name" value={form.project_name || '—'} />
                <Row label="Applicant" value={form.applicant_name || '—'} />
                <Row label="Sector" value={form.sector || '—'} />
                <Row label="Location" value={[form.district, form.state, form.country].filter(Boolean).join(', ') || '—'} />
                <Row label="Centroid" value={form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : 'Not specified'} />
                <Row label="Concession Area" value={form.scale_data.land_area_ha ? `${form.scale_data.land_area_ha} ha` : '—'} />
                <Row label="Prior Approval" value={form.has_prior_approval ? `Yes (${form.prior_approval_reference || 'Ref pending'})` : 'No'} />
              </div>

              <div className="p-4 rounded-xl text-xs leading-relaxed" style={{ background: '#E8F0EA', border: '1px solid #C4D7C8', color: '#19382D' }}>
                <p className="font-bold mb-1 flex items-center gap-1.5" style={{ color: '#19382D' }}>
                  <Sparkles size={14} style={{ color: '#19382D' }} />
                  Automated Fast Environmental Review (FER) Trigger
                </p>
                Submitting will register the spatial boundary in the database and automatically invoke the multi-sensor remote sensing pipeline (Copernicus Sentinel-2, Hansen Forest Loss, and Dynamic World) to identify candidate canopy disturbances.
              </div>

              {!form.project_name || !form.applicant_name || !form.sector ? (
                <div className="p-3 rounded-lg text-xs" style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B' }}>
                  Please complete required fields in Section B (project name, applicant, sector) before submitting.
                </div>
              ) : null}
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t" style={{ borderColor: '#DCE3DD' }}>
            <button onClick={prev} className="btn-secondary" disabled={stepIdx === 0}>
              <ChevronLeft size={16} /> Back
            </button>
            {step !== 'submit' ? (
              <button onClick={next} className="btn-primary">
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || !form.project_name || !form.applicant_name || !form.sector}
                className="btn-primary px-6 shadow-md"
              >
                {loading ? (
                  <><LoadingSpinner size={16} /> Generating Planetary FER…</>
                ) : (
                  <><Leaf size={16} /> Submit &amp; Generate FER</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="w-36 flex-shrink-0 font-medium" style={{ color: '#5A6E63' }}>{label}</span>
      <span className="font-semibold" style={{ color: '#19382D' }}>{value}</span>
    </div>
  );
}
