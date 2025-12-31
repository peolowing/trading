import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, fallback }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        Laddar...
      </div>
    );
  }

  if (!user) {
    return fallback || null;
  }

  return children;
}
