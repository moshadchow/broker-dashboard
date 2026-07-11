import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Profile from './components/Profile';
import Dashboard from './components/Dashboard';
import AdminLayout from './components/admin/AdminLayout';
import BrokerManagement from './components/admin/BrokerManagement';
import UserManagement from './components/admin/UserManagement';
import EndpointManagement from './components/admin/EndpointManagement';

function RootRedirect() {
  const { user, status } = useAuth();

  if (status === 'checking') {
    return (
      <div className="app-page flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        Checking session…
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          <Route element={<ProtectedRoute roles={['user', 'admin']} />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>

          <Route element={<ProtectedRoute roles={['user', 'admin']} />}>
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/brokers" replace />} />
              <Route path="brokers" element={<BrokerManagement />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="oms-endpoints" element={<EndpointManagement />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
