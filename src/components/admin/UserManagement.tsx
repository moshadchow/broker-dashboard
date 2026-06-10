import { useEffect, useState } from 'react';
import * as adminService from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import type { AdminBroker, AdminUser, UserRole } from '../../types/auth';

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
    {children}
  </th>
);

const TD = ({ children, className = '', colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={`px-4 py-3 text-sm text-gray-700 whitespace-nowrap ${className}`}>{children}</td>
);

const NO_BROKER = '__none__';

export default function UserManagement() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [brokers, setBrokers] = useState<AdminBroker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [newBrokerId, setNewBrokerId] = useState(NO_BROKER);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [editBrokerId, setEditBrokerId] = useState(NO_BROKER);
  const [editIsActive, setEditIsActive] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [u, b] = await Promise.all([adminService.listUsers(), adminService.listBrokers()]);
      setUsers(u);
      setBrokers(b);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function brokerLabel(brokerId: string | null): string {
    if (!brokerId) return '—';
    return brokers.find(b => b.brokerId === brokerId)?.brokerLabel ?? brokerId;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await adminService.createUser({
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
        brokerId: newBrokerId === NO_BROKER ? null : newBrokerId,
      });
      setNewEmail('');
      setNewPassword('');
      setNewRole('user');
      setNewBrokerId(NO_BROKER);
      await load();
    } catch {
      setError('Failed to create user. The email may already be registered.');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(user: AdminUser) {
    setEditingId(user.id);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditBrokerId(user.brokerId ?? NO_BROKER);
    setEditIsActive(user.isActive);
  }

  async function saveEdit(id: number) {
    setError(null);
    try {
      await adminService.updateUser(id, {
        email: editEmail.trim(),
        role: editRole,
        brokerId: editBrokerId === NO_BROKER ? null : editBrokerId,
        brokerIdSet: true,
        isActive: editIsActive,
      });
      setEditingId(null);
      await load();
    } catch {
      setError('Failed to update user.');
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await adminService.deleteUser(id);
      await load();
    } catch {
      setError('Failed to delete user.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Users</h2>
        <p className="text-sm text-gray-500">Manage user accounts, roles, and broker assignments.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-4 bg-white border border-gray-200 rounded-xl px-6 py-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
          <input
            type="email"
            required
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</label>
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as UserRole)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Broker</label>
          <select
            value={newBrokerId}
            onChange={e => setNewBrokerId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={NO_BROKER}>None</option>
            {brokers.map(b => (
              <option key={b.brokerId} value={b.brokerId}>{b.brokerLabel}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={creating}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {creating ? 'Adding…' : 'Add User'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Broker</TH>
              <TH>Active</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><TD className="text-gray-400" colSpan={5}>Loading…</TD></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><TD className="text-gray-400" colSpan={5}>No users yet.</TD></tr>
            )}
            {!loading && users.map(user => {
              const isEditing = editingId === user.id;
              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <TD className="font-medium">
                    {isEditing ? (
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      user.email
                    )}
                    {user.mustChangePassword && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Must change pw</span>
                    )}
                  </TD>
                  <TD>
                    {isEditing ? (
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value as UserRole)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>
                        {user.role}
                      </span>
                    )}
                  </TD>
                  <TD>
                    {isEditing ? (
                      <select
                        value={editBrokerId}
                        onChange={e => setEditBrokerId(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={NO_BROKER}>None</option>
                        {brokers.map(b => (
                          <option key={b.brokerId} value={b.brokerId}>{b.brokerLabel}</option>
                        ))}
                      </select>
                    ) : (
                      brokerLabel(user.brokerId)
                    )}
                  </TD>
                  <TD>
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={editIsActive}
                        onChange={e => setEditIsActive(e.target.checked)}
                        className="h-4 w-4"
                      />
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </TD>
                  <TD>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(user.id)}
                          className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-semibold transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(user)}
                          className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-semibold transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={user.id === currentUser?.id}
                          className="px-2 py-1 bg-red-100 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed text-red-700 rounded text-xs font-semibold transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
