import { useState, type FC, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth/AuthContext';

export const LoginPage: FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/home');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>VibeMint</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Login</p>

      {error && (
        <div
          style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: '#451a1a',
            color: '#f87171',
            borderRadius: '6px',
            fontSize: '0.875rem',
            textAlign: 'left',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="login-email"
            style={{
              display: 'block',
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              color: '#cbd5e1',
            }}
          >
            Email
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.9375rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label
            htmlFor="login-password"
            style={{
              display: 'block',
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              color: '#cbd5e1',
            }}
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '0.9375rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          id="login-submit-button"
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#6366f1',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
          }}
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div style={{ marginTop: '1.25rem', fontSize: '0.875rem' }}>
        <Link to="/signup" style={{ color: '#818cf8', textDecoration: 'none' }}>
          Need an account? Sign up
        </Link>
      </div>
    </section>
  );
};
