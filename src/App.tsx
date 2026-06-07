import { AuthProvider, useAuth } from './context/AuthContext'
import Dashboard from './components/Dashboard'
import Login from './components/Login'

function AuthGate() {
  const { status } = useAuth();

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">
        Checking session…
      </div>
    );
  }

  if (status === 'authenticated') {
    return <Dashboard />;
  }

  return <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}
