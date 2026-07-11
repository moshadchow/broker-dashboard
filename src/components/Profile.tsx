import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as authService from '../services/authService';
import ThemeToggle from './ThemeToggle';

export default function Profile() {
  const { user, refreshUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      await refreshUser();
    } catch {
      setError('Failed to change password. Check your current password and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-page">
      <header className="app-header">
        <h1 className="text-xl font-bold tracking-tight">Profile</h1>
        <div className="flex items-center gap-3 text-sm">
          <ThemeToggle />
          <Link
            to={user?.role === 'admin' ? '/admin' : '/dashboard'}
            className="header-action"
          >
            Back
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="panel-pad space-y-4">
          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">Signed in as</p>
            <p className="font-semibold text-[var(--color-text-primary)]">{user?.email}</p>
          </div>

          {user?.mustChangePassword && (
            <div className="alert-warning px-3 py-2">
              You must change your password before continuing.
            </div>
          )}

          {error && (
            <div className="alert-error px-3 py-2">
              {error}
            </div>
          )}

          {success && (
            <div className="alert-success px-3 py-2">
              Password changed successfully.
            </div>
          )}

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="field w-full"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="button-primary w-full px-4"
            >
              {submitting ? 'Saving…' : 'Change Password'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
