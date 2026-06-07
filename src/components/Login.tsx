import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { status, error, mfaKey, login } = useAuth();
  const [loginId, setLoginId]   = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode]   = useState('');

  const mfaStep   = status === 'mfa-required' || !!mfaKey;
  const submitting = status === 'checking';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    login(loginId, password, mfaStep ? mfaCode : undefined);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Broker Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Login ID</label>
            <input
              type="text"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              disabled={mfaStep || submitting}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={mfaStep || submitting}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          {mfaStep && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">MFA Code</label>
              <input
                type="text"
                value={mfaCode}
                onChange={e => setMfaCode(e.target.value)}
                disabled={submitting}
                required
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
              <p className="text-xs text-gray-400 mt-1">Enter the code from your authenticator.</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? 'Signing in…' : mfaStep ? 'Verify' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
