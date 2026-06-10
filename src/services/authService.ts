import { ENDPOINTS } from '../config/api';
import { httpClient } from './httpClient';
import { clearTokens, getTokens, setTokens } from './tokenStorage';
import type { ChangePasswordRequest, LoginRequest, TokenResponse, User } from '../types/auth';

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  const res = await httpClient.post<TokenResponse>(ENDPOINTS.login, payload);
  setTokens(res.data);
  return res.data;
}

export async function logout(): Promise<void> {
  const tokens = getTokens();
  if (tokens?.refreshToken) {
    try {
      await httpClient.post(ENDPOINTS.logout, { refreshToken: tokens.refreshToken });
    } catch {
      // ignore network/logout errors — clear local session regardless
    }
  }
  clearTokens();
}

export async function changePassword(payload: ChangePasswordRequest): Promise<void> {
  await httpClient.post(ENDPOINTS.changePassword, payload);
}

export async function fetchMe(): Promise<User> {
  const res = await httpClient.get<User>(ENDPOINTS.me);
  return res.data;
}
