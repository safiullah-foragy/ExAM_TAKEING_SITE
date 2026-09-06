import axios from 'axios';

// In production on Vercel, set VITE_API_URL=https://your-backend.onrender.com
export const API_ORIGIN = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : '';

export const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally only for authenticated requests
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      // Do not clear session or redirect on login/auth verification requests that fail with 401
      const isAuthAttempt =
        url.includes('/auth/login') ||
        url.includes('/admin/login') ||
        url.includes('/auth/verify-otp') ||
        url.includes('/auth/verify-forgot-otp') ||
        url.includes('/auth/forgot-password');

      if (!isAuthAttempt) {
        if (url.includes('/admin') || (localStorage.getItem('adminToken') && !localStorage.getItem('token'))) {
          localStorage.removeItem('adminToken');
          window.location.href = '/admin/login';
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;
