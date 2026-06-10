import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { BASE_URL, ENDPOINTS } from '../config/api';
import { clearTokens, getTokens, setTokens } from './tokenStorage';
import type { TokenResponse } from '../types/auth';

export const httpClient = axios.create({ baseURL: BASE_URL });

httpClient.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens?.accessToken) {
    config.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return null;

  try {
    const res = await axios.post<TokenResponse>(`${BASE_URL}${ENDPOINTS.refresh}`, {
      refreshToken: tokens.refreshToken,
    });
    setTokens(res.data);
    return res.data.accessToken;
  } catch {
    return null;
  }
}

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes(ENDPOINTS.login) || originalRequest.url?.includes(ENDPOINTS.refresh)) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });

    const newAccessToken = await refreshPromise;
    if (!newAccessToken) {
      clearTokens();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
    return httpClient(originalRequest);
  },
);
