import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, status, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (status === 'authenticated' && user) {
    if (user.mustChangePassword) return <Navigate to="/profile" replace />;
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const me = await login({ email, password });
      if (me.mustChangePassword) {
        navigate('/profile', { replace: true });
      } else {
        navigate(me.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
      }
    } catch {
      setFormError('Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-page flex items-center justify-center px-4">
      <div className="w-full max-w-sm panel-pad space-y-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Sign in</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">Broker Execution vs Market Dashboard</p>
        </div>

        {formError && (
          <div className="alert-error px-3 py-2">
            {formError}
          </div>
        )}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="field w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="field w-full"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="button-primary w-full px-4"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
