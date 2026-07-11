import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

interface ProtectedRouteProps {
  roles?: UserRole[];
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
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

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <Outlet />;
}
