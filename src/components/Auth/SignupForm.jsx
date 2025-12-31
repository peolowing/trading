import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AuthForms.css';

export default function SignupForm({ onToggleForm, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  const { signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('Lösenorden matchar inte');
      return;
    }

    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);
      setSignupComplete(true);
    } catch (err) {
      setError(err.message || 'Registrering misslyckades');
    } finally {
      setLoading(false);
    }
  };

  if (signupComplete) {
    return (
      <div className="auth-form">
        <h2>Kontrollera Din Email</h2>
        <div className="success-message">
          <p>Ett bekräftelsemail har skickats till:</p>
          <p><strong>{email}</strong></p>
          <p>Klicka på länken i mailet för att aktivera ditt konto.</p>
        </div>
        <button
          type="button"
          className="link-button"
          onClick={onToggleForm}
        >
          Tillbaka till inloggning
        </button>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <h2>Skapa Konto</h2>
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
            placeholder="Minst 6 tecken"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Bekräfta Lösenord</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Upprepa lösenord"
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Skapar konto...' : 'Skapa Konto'}
        </button>

        <div className="form-footer">
          <button
            type="button"
            className="link-button"
            onClick={onToggleForm}
          >
            Har redan ett konto? Logga in
          </button>
        </div>
      </form>
    </div>
  );
}
