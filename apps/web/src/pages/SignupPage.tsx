import { useState, type FC, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/auth/AuthContext';

export const SignupPage: FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signup(email, password);
      navigate('/home');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>VibeMint</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>Create Account</p>

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
            htmlFor="signup-email"
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
            id="signup-email"
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
            htmlFor="signup-password"
            style={{
              display: 'block',
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              color: '#cbd5e1',
            }}
          >
            Password (min 8 characters)
          </label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
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
          id="signup-submit-button"
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
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <div style={{ marginTop: '1.25rem', fontSize: '0.875rem' }}>
        <Link to="/login" style={{ color: '#818cf8', textDecoration: 'none' }}>
          Already have an account? Log in
        </Link>
      </div>
    </section>
  );
};
