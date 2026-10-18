/**
 * EcoSentinel API client
 */
import axios from 'axios';

// In production (Cloud Run), Next.js rewrites /api/v1/* → backend via BACKEND_URL env var.
// NEXT_PUBLIC_API_URL must be left unset or set to /api/v1 so calls are relative.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';


export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Inject token from localStorage if present
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      const isLoginOrAuth =
        window.location.pathname.startsWith('/login') ||
        window.location.pathname.startsWith('/register') ||
        err.config?.url?.includes('/auth/login');
      if (!isLoginOrAuth) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { email: string; password: string; full_name: string; organization?: string; role?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  firebaseLogin: (data: { email: string; full_name?: string; role?: string; firebase_uid?: string; organization?: string }) =>
    api.post('/auth/firebase-login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/auth/change-password', data),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsAPI = {
  list: () => api.get('/projects'),
  create: (data: any) => api.post('/projects', data),
  get: (id: string) => api.get(`/projects/${id}`),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data),
  uploadDocument: (id: string, file: File, type: string) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/projects/${id}/documents?document_type=${type}`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  addBoundary: (id: string, data: any) => api.post(`/projects/${id}/boundaries`, data),
  listBoundaries: (id: string) => api.get(`/projects/${id}/boundaries`),
  generateFER: (id: string) => api.post(`/projects/${id}/generate-fer`),
  listFERs: (id: string) => api.get(`/projects/${id}/fer`),
  listFindings: (id: string) => api.get(`/projects/${id}/findings`),
};

// ── FER ───────────────────────────────────────────────────────────────────────
export const ferAPI = {
  get: (id: string) => api.get(`/fer/${id}`),
  versions: (id: string) => api.get(`/fer/${id}/versions`),
  export: (id: string) => api.post(`/fer/${id}/export?format=json`),
  exportPdf: (id: string) => api.get(`/fer/${id}/pdf`, { responseType: 'blob' }),
};

// ── Findings ──────────────────────────────────────────────────────────────────
export const findingsAPI = {
  get: (id: string) => api.get(`/findings/${id}`),
  challenge: (id: string, notes?: string) =>
    api.post(`/findings/${id}/challenge`, { notes }),
  review: (id: string, data: any) => api.post(`/findings/${id}/review`, data),
};

// ── Watch Plans ───────────────────────────────────────────────────────────────
export const watchAPI = {
  list: () => api.get('/watch-plans'),
  create: (data: any) => api.post('/watch-plans', data),
  run: (id: string) => api.post(`/watch-plans/${id}/run`),
  history: (id: string) => api.get(`/watch-plans/${id}/history`),
};

// ── Cases ──────────────────────────────────────────────────────────────────────
export const casesAPI = {
  list: () => api.get('/cases'),
  get: (id: string) => api.get(`/cases/${id}`),
  addEvent: (id: string, data: any) => api.post(`/cases/${id}/events`, data),
};

export const systemAPI = {
  health: () => api.get('/health'),
  status: () => api.get('/system/status'),
  aiStatus: () => api.get('/ai/status'),
  ttsStatus: () => api.get('/tts/status'),
  deployment: () => api.get('/deployment/architecture'),
  getKalimantanShowcase: () => api.get('/system/showcase/kalimantan'),
  downloadKalimantanCSV: () =>
    api.get('/system/showcase/kalimantan/csv', { responseType: 'blob' }),
  downloadKalimantanGeoJSON: () =>
    api.get('/system/showcase/kalimantan/geojson', { responseType: 'blob' }),
};

// ── Chat & TTS ────────────────────────────────────────────────────────────────
export const chatAPI = {
  send: (data: any) => api.post('/chat', data),
};

export const ttsAPI = {
  synthesize: (text: string) => api.post('/tts', { text }),
  getAudio: (audioId: string) => `${API_BASE}/tts/${audioId}`,
};

// ── Earth Observation & STAC ──────────────────────────────────────────────────
export const eoAPI = {
  searchSTAC: (data: any) => api.post('/eo/stac-search', data),
  validatePair: (data: any) => api.post('/eo/validate-pair', data),
  runAnalysis: (data?: any) => api.post('/eo/analysis', data ?? {}),
  exportGeoJSON: (params?: any) => api.get('/eo/geojson/export', { params }),
  reverseGeocode: (lat: number, lng: number) =>
    api.get('/eo/reverse-geocode', { params: { lat, lng } }),
};
