import axios, { type InternalAxiosRequestConfig } from 'axios';
import { TOKEN_REFRESH_SKEW_MS } from '../config/api';
import { getSession, clearSession } from './tokenStorage';
import { refreshAccessToken } from './authService';

export const SESSION_INVALIDATED_EVENT = 'broker-dashboard:session-invalidated';

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

let refreshPromise: Promise<string> | null = null;

function isExpiringSoon(expiryIso: string): boolean {
  const expiryMs = new Date(expiryIso).getTime();
  return expiryMs - Date.now() <= TOKEN_REFRESH_SKEW_MS;
}

async function getValidAccessToken(): Promise<string | null> {
  const session = getSession();
  if (!session) return null;

  if (!isExpiringSoon(session.accessTokenExpiryDateTimeUtc)) {
    return session.accessToken;
  }

  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .then(refreshed => refreshed.accessToken)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

function invalidateSession(): void {
  clearSession();
  window.dispatchEvent(new Event(SESSION_INVALIDATED_EVENT));
}

export function installAuthInterceptors(client = axios): void {
  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await getValidAccessToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  });

  client.interceptors.response.use(
    response => response,
    async error => {
      const original = error.config as InternalAxiosRequestConfig | undefined;

      if (error.response?.status === 401 && original && !original._retry) {
        original._retry = true;
        try {
          const refreshed = await refreshAccessToken();
          original.headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
          return client(original);
        } catch {
          invalidateSession();
          return Promise.reject(error);
        }
      }

      if (error.response?.status === 401) {
        invalidateSession();
      }

      return Promise.reject(error);
    },
  );
}
