import { useEffect, useState } from 'react';
import * as adminService from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import type { AdminBroker, AdminUser, UserRole } from '../../types/auth';

const TH = ({ children }: { children: React.ReactNode }) => (
  <th className="table-th">
    {children}
  </th>
);

const TD = ({ children, className = '', colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) => (
  <td colSpan={colSpan} className={`table-td ${className}`}>{children}</td>
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
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Users</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">Manage user accounts, roles, and broker assignments.</p>
      </div>

      {error && (
        <div className="alert-error">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="panel flex flex-wrap items-end gap-4 px-6 py-4">
        <div className="flex flex-col gap-1">
          <label className="field-label">Email</label>
          <input
            type="email"
            required
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="field w-56"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="field-label">Password</label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="field w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="field-label">Role</label>
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value as UserRole)}
            className="field"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="field-label">Broker</label>
          <select
            value={newBrokerId}
            onChange={e => setNewBrokerId(e.target.value)}
            className="field w-40"
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
          className="button-primary"
        >
          {creating ? 'Adding…' : 'Add User'}
        </button>
      </form>

      <div className="table-wrap">
        <table className="w-full text-left">
          <thead className="table-head">
            <tr>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Broker</TH>
              <TH>Active</TH>
              <TH>Actions</TH>
            </tr>
          </thead>
          <tbody className="table-body">
            {loading && (
              <tr><TD className="text-[var(--color-text-muted)]" colSpan={5}>Loading…</TD></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><TD className="text-[var(--color-text-muted)]" colSpan={5}>No users yet.</TD></tr>
            )}
            {!loading && users.map(user => {
              const isEditing = editingId === user.id;
              return (
                <tr key={user.id} className="table-row">
                  <TD className="font-medium">
                    {isEditing ? (
                      <input
                        type="email"
                        value={editEmail}
                        onChange={e => setEditEmail(e.target.value)}
                        className="field-compact w-56"
                      />
                    ) : (
                      user.email
                    )}
                    {user.mustChangePassword && (
                      <span className="badge-warning ml-2">Must change pw</span>
                    )}
                  </TD>
                  <TD>
                    {isEditing ? (
                      <select
                        value={editRole}
                        onChange={e => setEditRole(e.target.value as UserRole)}
                        className="field-compact"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    ) : (
                      <span className={user.role === 'admin' ? 'badge-primary' : 'badge-muted'}>
                        {user.role}
                      </span>
                    )}
                  </TD>
                  <TD>
                    {isEditing ? (
                      <select
                        value={editBrokerId}
                        onChange={e => setEditBrokerId(e.target.value)}
                        className="field-compact w-40"
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
                      <span className={user.isActive ? 'badge-success' : 'badge-muted'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </TD>
                  <TD>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(user.id)}
                          className="button-success"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="button-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(user)}
                          className="button-muted"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          disabled={user.id === currentUser?.id}
                          className="button-danger"
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
