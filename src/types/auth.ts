export type UserRole = 'admin' | 'user';

export interface User {
  id:                 number;
  email:              string;
  role:               UserRole;
  brokerId:           string | null;
  isActive:           boolean;
  mustChangePassword: boolean;
}

export interface AdminUser extends User {
  createdAt: string;
  updatedAt: string;
}

export interface AdminBroker {
  brokerId:      string;
  brokerLabel:   string;
  externalApiId: string | null;
  apiEndpoint:   string | null;
  createdAt:     string;
  updatedAt:     string;
}

export interface AdminOmsEndpoint {
  name:           string;
  baseUrl:        string;
  credentialName: string;
  username:       string;
  deviceId:       string;
  appType:        number;
  createdAt:      string;
  updatedAt:      string;
}

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface TokenResponse {
  accessToken:  string;
  refreshToken: string;
  tokenType:    string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword:     string;
}

export interface UserCreateInput {
  email:    string;
  password: string;
  role:     UserRole;
  brokerId: string | null;
}

export interface UserUpdateInput {
  email?:       string;
  brokerId?:    string | null;
  brokerIdSet?: boolean;
  isActive?:    boolean;
  role?:        UserRole;
}

export interface BrokerCreateInput {
  brokerId:       string;
  brokerLabel:    string;
  externalApiId?: string | null;
  apiEndpoint?:   string | null;
}

export interface BrokerUpdateInput {
  brokerLabel:    string;
  externalApiId?: string | null;
  apiEndpoint?:   string | null;
}

export interface OmsEndpointCreateInput {
  name:           string;
  baseUrl:        string;
  credentialName: string;
  username:       string;
  password:       string;
  deviceId:       string;
  appType:        number;
}

export interface OmsEndpointUpdateInput {
  baseUrl:   string;
  username:  string;
  password?: string | null;
  deviceId:  string;
  appType:   number;
}

export type AuthStatus = 'checking' | 'unauthenticated' | 'authenticated';

export interface AuthState {
  status: AuthStatus;
  user:   User | null;
  error:  string | null;
}
