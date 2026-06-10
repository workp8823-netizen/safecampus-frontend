import axios, { type AxiosRequestConfig } from 'axios';
import { DEMO_USER, UG_DEMO_DATA } from './mockData';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─── Axios Instance ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach Authorization token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || (typeof document !== 'undefined' ? document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1] : null);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise error messages from the backend response body
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || 'An unknown error occurred';
    const status = error.response?.status;
    const err = new Error(message) as any;
    err.status = status;
    return Promise.reject(err);
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Simple delay to simulate network latency in demo mode
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Unified API Request (demo-aware) ────────────────────────────────────────

import { getCookie } from './cookies';

export async function apiRequest(endpoint: string, options: AxiosRequestConfig = {}) {
  const isDemoPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo');
  const isDemo = getCookie('isDemo') === true || isDemoPath;
  const isUgInstitution = endpoint.includes(UG_DEMO_DATA.institution.id);

  // Intercept UG Demo Logins universally
  if (endpoint.includes('/auth/login') && options.data) {
    try {
      const body = typeof options.data === 'string' ? JSON.parse(options.data) : options.data;
      if (isDemo && (body.email?.endsWith('@ug.edu.gh') || isDemoPath)) {
        await delay(500);
        const prefix = body.email?.split('@')[0]?.toUpperCase() || 'STUDENT';
        const role =
          prefix === 'ADMIN' ? 'SCHOOL_ADMIN' : prefix === 'SECURITY' ? 'SECURITY' : 'STUDENT';
        return {
          ...DEMO_USER,
          isDemo: true,
          user: { ...DEMO_USER.user, email: body.email || 'student@ug.edu.gh', role },
        };
      }
    } catch (_) {}
  }

  if (
    (isDemo ||
      isUgInstitution ||
      getCookie('institutionId') === UG_DEMO_DATA.institution.id) &&
    !endpoint.includes('/admin/') // Do NOT intercept super admin management routes
  ) {
    if (isDemo) await delay(300);

    // Auth fallbacks
    if (endpoint.includes('/auth/login')) return { ...DEMO_USER, isDemo: true };
    if (endpoint.includes('/auth/register'))
      return { message: 'Demo registration successful', userId: 'demo-user', isDemo: true };
    if (endpoint.includes('/users/profile')) {
      if (options.method === 'PATCH') {
        return { ...DEMO_USER.user, ...options.data };
      }
      return DEMO_USER.user;
    }

    // Map & Boundaries
    if (endpoint.includes('/institutions/') && endpoint.endsWith('/hotspots'))
      return UG_DEMO_DATA.hotspots;
    if (isDemo && endpoint.includes('/institutions/list')) return [UG_DEMO_DATA.institution];
    if (!endpoint.includes('/list') && endpoint.includes('/institutions/'))
      return UG_DEMO_DATA.institution;

    // Incidents — order matters: specific paths first
    if (endpoint.includes('/incidents/stats'))      return UG_DEMO_DATA.stats;
    if (endpoint.includes('/incidents/analytics'))  return UG_DEMO_DATA.analytics;
    if (endpoint.includes('/incidents/my-reports')) return UG_DEMO_DATA.incidents.map((i: any) => ({ ...i, reporter_id: 'demo-user' }));
    if (endpoint.includes('/incidents'))            return { incidents: UG_DEMO_DATA.incidents, total: UG_DEMO_DATA.incidents.length, pages: 1 };

    // Officers
    if (endpoint.includes('/users/officers')) return UG_DEMO_DATA.officers;

    // Buddies (demo stubs)
    if (endpoint.includes('/buddies')) {
      if (options.method === 'POST') return { id: 'demo-buddy-1', status: 'PENDING' };
      if (options.method === 'PATCH') return { id: (endpoint.split('/').pop()), status: options.data?.status };
      if (options.method === 'DELETE') return { message: 'Buddy removed' };
      return UG_DEMO_DATA.buddies || [];
    }

    // Emergency Contacts (demo stubs)
    if (endpoint.includes('/contacts')) {
      if (options.method === 'POST') return { id: 'demo-contact-1', ...options.data };
      if (options.method === 'DELETE') return { message: 'Contact removed' };
      return UG_DEMO_DATA.contacts || [];
    }

    // Alerts
    if (endpoint.includes('/alerts')) return UG_DEMO_DATA.alerts;

    // --- Write Operations (Demo Safety) ---
    if (options.method === 'PATCH' || options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
      if (endpoint.includes('/institutions/')) {
        return { ...UG_DEMO_DATA.institution, ...options.data, message: 'Demo: Changes saved locally (not persisted to DB)' };
      }
      if (endpoint.includes('/hotspots') || endpoint.includes('/landmarks')) {
        return { message: 'Demo: Landmark updated successfully' };
      }
      if (endpoint.includes('/incidents')) {
        return { id: 'demo-inc-' + Date.now(), status: 'PENDING', ...options.data };
      }
    }

    // Fallback for unmatched demo routes
    if (isDemo) return {};
  }

  // Real Network Requests — axios handles auth header via interceptor above
  const response = await api.request({ url: endpoint, ...options });
  return response.data;
}
