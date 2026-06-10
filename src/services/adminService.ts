import { ENDPOINTS, adminBrokerById, adminUserById } from '../config/api';
import { httpClient } from './httpClient';
import type {
  AdminBroker,
  AdminUser,
  BrokerCreateInput,
  BrokerUpdateInput,
  UserCreateInput,
  UserUpdateInput,
} from '../types/auth';

export async function listBrokers(): Promise<AdminBroker[]> {
  const res = await httpClient.get<AdminBroker[]>(ENDPOINTS.adminBrokers);
  return res.data;
}

export async function createBroker(payload: BrokerCreateInput): Promise<AdminBroker> {
  const res = await httpClient.post<AdminBroker>(ENDPOINTS.adminBrokers, payload);
  return res.data;
}

export async function updateBroker(brokerId: string, payload: BrokerUpdateInput): Promise<AdminBroker> {
  const res = await httpClient.put<AdminBroker>(adminBrokerById(brokerId), payload);
  return res.data;
}

export async function deleteBroker(brokerId: string): Promise<void> {
  await httpClient.delete(adminBrokerById(brokerId));
}

export async function listUsers(): Promise<AdminUser[]> {
  const res = await httpClient.get<AdminUser[]>(ENDPOINTS.adminUsers);
  return res.data;
}

export async function createUser(payload: UserCreateInput): Promise<AdminUser> {
  const res = await httpClient.post<AdminUser>(ENDPOINTS.adminUsers, payload);
  return res.data;
}

export async function updateUser(id: number, payload: UserUpdateInput): Promise<AdminUser> {
  const res = await httpClient.put<AdminUser>(adminUserById(id), payload);
  return res.data;
}

export async function deleteUser(id: number): Promise<void> {
  await httpClient.delete(adminUserById(id));
}
