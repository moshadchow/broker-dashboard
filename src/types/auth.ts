export interface LoginRequest {
  loginId:  string;
  password: string;
  deviceId: string;
  mfaKey:   string;
  mfaCode:  string;
  appType:  number;
}

export interface RefreshTokenRequest {
  accessToken:  string;
  refreshToken: string;
  deviceId:     string;
}

export interface AuthData {
  userId:                       string;
  accessToken:                  string;
  refreshToken:                 string;
  accessTokenExpiryDateTimeUtc: string;
  success:                      boolean;
  errorMessage:                 string | null;
  displayName:                  string;
  email:                        string;
  isAuthorised:                 boolean;
  isAuthenticated:              boolean;
  serverDateTimeUtc:            string;
  isMfaRequired:                boolean;
  mfaKey:                       string | null;
  passwordChangeRequired:       boolean;
}

interface AuthApiEnvelope {
  data:         AuthData;
  success:      boolean;
  errorMessage: string | null;
}

export type LoginApiResponse = AuthApiEnvelope;
export type RefreshTokenApiResponse = AuthApiEnvelope;

// Persisted in storage to restore the session and drive proactive refresh
export interface StoredSession {
  userId:                       string;
  accessToken:                  string;
  refreshToken:                 string;
  accessTokenExpiryDateTimeUtc: string;
  displayName:                  string;
  email:                        string;
}

export type AuthStatus =
  | 'checking'
  | 'unauthenticated'
  | 'mfa-required'
  | 'authenticated';

export interface AuthState {
  status:  AuthStatus;
  user:    { userId: string; displayName: string; email: string } | null;
  mfaKey:  string | null;
  error:   string | null;
}
