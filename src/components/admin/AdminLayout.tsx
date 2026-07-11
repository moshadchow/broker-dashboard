import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ThemeToggle';

export default function AdminLayout() {
  const { user, logout } = useAuth();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-row-hover)]'
    }`;

  return (
    <div className="app-page">
      <header className="app-header">
        <h1 className="text-xl font-bold tracking-tight">
          XFL Admin <span className="text-[var(--color-primary)]">Panel</span>
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <ThemeToggle />
          <span className="header-chip">
            {user?.email}
          </span>
          <Link
            to="/profile"
            className="header-action"
          >
            Profile
          </Link>
          <button
            onClick={() => logout()}
            className="header-action"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
        <nav className="w-48 flex-shrink-0 space-y-1">
          <NavLink to="/admin/brokers" className={navLinkClass}>Brokers</NavLink>
          <NavLink to="/admin/users" className={navLinkClass}>Users</NavLink>
          <NavLink to="/admin/oms-endpoints" className={navLinkClass}>API Endpoints</NavLink>
        </nav>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
