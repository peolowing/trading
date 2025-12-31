import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthForms.css';

export default function LoginForm({ onToggleForm, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const { signIn, resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Inloggning misslyckades');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setResetEmailSent(true);
    } catch (err) {
      setError(err.message || 'Kunde inte skicka återställningslänk');
    } finally {
      setLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div className="auth-form">
        <h2>Återställ Lösenord</h2>
        {resetEmailSent ? (
          <div className="success-message">
            <p>En återställningslänk har skickats till {email}</p>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setShowForgotPassword(false);
                setResetEmailSent(false);
              }}
            >
              Tillbaka till inloggning
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@email.se"
                required
                autoFocus
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Skickar...' : 'Skicka Återställningslänk'}
            </button>

            <button
              type="button"
              className="link-button"
              onClick={() => setShowForgotPassword(false)}
            >
              Tillbaka till inloggning
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="auth-form">
      <h2>Logga In</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@email.se"
            required
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Lösenord</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Loggar in...' : 'Logga In'}
        </button>

        <div className="form-footer">
          <button
            type="button"
            className="link-button"
            onClick={() => setShowForgotPassword(true)}
          >
            Glömt lösenord?
          </button>
          <button
            type="button"
            className="link-button"
            onClick={onToggleForm}
          >
            Skapa konto
          </button>
        </div>
      </form>
    </div>
  );
}
