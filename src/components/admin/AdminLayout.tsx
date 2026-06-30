import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLayout() {
  const { user, logout } = useAuth();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-6 py-4 shadow flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">
          XFL Admin <span className="text-blue-400">Panel</span>
        </h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1.5 bg-gray-700 rounded-lg text-xs font-semibold text-gray-300">
            {user?.email}
          </span>
          <Link
            to="/profile"
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold text-gray-300 transition-colors"
          >
            Profile
          </Link>
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold text-gray-300 transition-colors"
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
