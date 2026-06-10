import type { TokenResponse } from '../types/auth';

const STORAGE_KEY = 'broker_dashboard_auth_tokens';

interface StoredTokens {
  accessToken:  string;
  refreshToken: string;
}

export function getTokens(): StoredTokens | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return null;
  }
}

export function setTokens(tokens: TokenResponse): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
  );
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}
