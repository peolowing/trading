import { useState } from 'react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import './AuthModal.css';

export default function AuthModal({ onClose }) {
  const [showLogin, setShowLogin] = useState(true);

  const handleSuccess = () => {
    if (onClose) onClose();
  };

  const toggleForm = () => {
    setShowLogin(!showLogin);
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>
          ×
        </button>
        {showLogin ? (
          <LoginForm onToggleForm={toggleForm} onSuccess={handleSuccess} />
        ) : (
          <SignupForm onToggleForm={toggleForm} onSuccess={handleSuccess} />
        )}
      </div>
    </div>
  );
}
