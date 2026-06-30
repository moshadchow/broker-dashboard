import { useEffect, useState } from 'react';
import * as adminService from '../../services/adminService';
import type { AdminOmsEndpoint } from '../../types/auth';

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
    {children}
  </th>
);

const TD = ({ children, className = '', colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={`px-4 py-3 text-sm text-gray-700 whitespace-nowrap ${className}`}>{children}</td>
);

export default function EndpointManagement() {
  const [endpoints, setEndpoints] = useState<AdminOmsEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newCredentialName, setNewCredentialName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newAppType, setNewAppType] = useState('1');
  const [creating, setCreating] = useState(false);

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editBaseUrl, setEditBaseUrl] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editDeviceId, setEditDeviceId] = useState('');
  const [editAppType, setEditAppType] = useState('1');
  const [editResetPassword, setEditResetPassword] = useState(false);
  const [editPassword, setEditPassword] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setEndpoints(await adminService.listOmsEndpoints());
    } catch {
      setError('Failed to load API endpoints.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await adminService.createOmsEndpoint({
        name: newName.trim(),
        baseUrl: newBaseUrl.trim(),
        credentialName: newCredentialName.trim(),
        username: newUsername.trim(),
        password: newPassword,
        deviceId: newDeviceId.trim(),
        appType: Number(newAppType) || 1,
      });
      setNewName('');
      setNewBaseUrl('');
      setNewCredentialName('');
      setNewUsername('');
      setNewPassword('');
      setNewDeviceId('');
      setNewAppType('1');
      await load();
    } catch {
      setError('Failed to create endpoint. The endpoint name or credential name may already exist.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(endpoint: AdminOmsEndpoint) {
    setEditingName(endpoint.name);
    setEditBaseUrl(endpoint.baseUrl);
    setEditUsername(endpoint.username);
    setEditDeviceId(endpoint.deviceId);
    setEditAppType(String(endpoint.appType));
    setEditResetPassword(false);
    setEditPassword('');
  }

  async function saveEdit(name: string) {
    setError(null);
    try {
      await adminService.updateOmsEndpoint(name, {
        baseUrl: editBaseUrl.trim(),
        username: editUsername.trim(),
        deviceId: editDeviceId.trim(),
        appType: Number(editAppType) || 1,
        password: editResetPassword ? editPassword : null,
      });
      setEditingName(null);
      await load();
    } catch {
      setError('Failed to update endpoint.');
    }
  }

  async function handleDelete(name: string) {
    setError(null);
    try {
      await adminService.deleteOmsEndpoint(name);
      await load();
    } catch {
      setError('Failed to delete endpoint. It may still be assigned to a broker.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">API Endpoints</h2>
        <p className="text-sm text-gray-500">Manage the OMS endpoints brokers are routed to (base URL + service-account credentials).</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4 bg-white border border-gray-200 rounded-xl px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</label>
          <input
            type="text"
            required
            maxLength={20}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. secondary"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Base URL</label>
          <input
            type="text"
            required
            maxLength={255}
            value={newBaseUrl}
            onChange={e => setNewBaseUrl(e.target.value)}
            placeholder="https://…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Credential Name</label>
          <input
            type="text"
            required
            maxLength={32}
            value={newCredentialName}
            onChange={e => setNewCredentialName(e.target.value)}
            placeholder="e.g. secondary_oms"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Username</label>
          <input
            type="text"
            required
            maxLength={100}
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password</label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Device ID</label>
          <input
            type="text"
            required
            maxLength={100}
            value={newDeviceId}
            onChange={e => setNewDeviceId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">App Type</label>
          <input
            type="number"
            value={newAppType}
            onChange={e => setNewAppType(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={creating}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {creating ? 'Adding…' : 'Add Endpoint'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <TH>Name</TH>
              <TH>Base URL</TH>
              <TH>Credential Name</TH>
              <TH>Username</TH>
              <TH>Device ID</TH>
              <TH>App Type</TH>
              <TH>Updated</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><TD className="text-gray-400" colSpan={8}>Loading…</TD></tr>
            )}
            {!loading && endpoints.length === 0 && (
              <tr><TD className="text-gray-400" colSpan={8}>No API endpoints yet.</TD></tr>
            )}
            {!loading && endpoints.map(endpoint => (
              <tr key={endpoint.name} className="hover:bg-gray-50">
                <TD className="font-medium">{endpoint.name}</TD>
                <TD>
                  {editingName === endpoint.name ? (
                    <input
                      type="text"
                      value={editBaseUrl}
                      onChange={e => setEditBaseUrl(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    endpoint.baseUrl
                  )}
                </TD>
                <TD className="text-gray-400">{endpoint.credentialName}</TD>
                <TD>
                  {editingName === endpoint.name ? (
                    <input
                      type="text"
                      value={editUsername}
                      onChange={e => setEditUsername(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    endpoint.username
                  )}
                </TD>
                <TD>
                  {editingName === endpoint.name ? (
                    <input
                      type="text"
                      value={editDeviceId}
                      onChange={e => setEditDeviceId(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    endpoint.deviceId
                  )}
                </TD>
                <TD>
                  {editingName === endpoint.name ? (
                    <input
                      type="number"
                      value={editAppType}
                      onChange={e => setEditAppType(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    endpoint.appType
                  )}
                </TD>
                <TD>{new Date(endpoint.updatedAt).toLocaleString()}</TD>
                <TD>
                  {editingName === endpoint.name ? (
                    <div className="flex flex-col gap-2">
                      {editResetPassword ? (
                        <input
                          type="password"
                          placeholder="New password"
                          value={editPassword}
                          onChange={e => setEditPassword(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditResetPassword(true)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold text-left"
                        >
                          Reset password
                        </button>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(endpoint.name)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingName(null)}
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(endpoint)}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(endpoint.name)}
                        className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-semibold transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
