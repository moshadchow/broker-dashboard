import axios from 'axios';
import { BASE_URL, ENDPOINTS, APP_TYPE } from '../config/api';
import { getOrCreateDeviceId, getSession, saveSession, clearSession } from './tokenStorage';
import type {
  AuthData,
  LoginApiResponse,
  RefreshTokenApiResponse,
  StoredSession,
} from '../types/auth';

function toStoredSession(data: AuthData): StoredSession {
  return {
    userId:                       data.userId,
    accessToken:                  data.accessToken,
    refreshToken:                 data.refreshToken,
    accessTokenExpiryDateTimeUtc: data.accessTokenExpiryDateTimeUtc,
    displayName:                  data.displayName,
    email:                        data.email,
  };
}

export async function login(
  loginId: string,
  password: string,
  mfaKey: string = '',
  mfaCode: string = '',
): Promise<AuthData> {
  const res = await axios.post<LoginApiResponse>(
    `${BASE_URL}${ENDPOINTS.login}`,
    {
      loginId,
      password,
      deviceId: getOrCreateDeviceId(),
      mfaKey,
      mfaCode,
      appType: APP_TYPE,
    },
  );

  const { data } = res.data;
  if (!res.data.success || !data.success) {
    throw new Error(data.errorMessage ?? res.data.errorMessage ?? 'Login failed');
  }
  if (!data.isMfaRequired) {
    saveSession(toStoredSession(data));
  }
  return data;
}

export async function refreshAccessToken(): Promise<StoredSession> {
  const session = getSession();
  if (!session) {
    throw new Error('No session to refresh');
  }

  const res = await axios.post<RefreshTokenApiResponse>(
    `${BASE_URL}${ENDPOINTS.refreshToken}`,
    {
      accessToken:  session.accessToken,
      refreshToken: session.refreshToken,
      deviceId:     getOrCreateDeviceId(),
    },
  );

  const { data } = res.data;
  if (!res.data.success || !data.success) {
    clearSession();
    throw new Error(data.errorMessage ?? res.data.errorMessage ?? 'Token refresh failed');
  }

  const refreshed = toStoredSession(data);
  saveSession(refreshed);
  return refreshed;
}

export function logout(): void {
  clearSession();
}
