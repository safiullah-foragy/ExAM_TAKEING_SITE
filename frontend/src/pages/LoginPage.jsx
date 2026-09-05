import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Please fill all fields');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', {
        email: form.email.trim(),
        password: form.password,
      });
      login(res.data.token, res.data.user);
      toast.success('Welcome back! 🎉');
      navigate('/profile');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Dynamic Animated Ambient Background */}
      <div className="auth-ambient-glow">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-blob auth-blob-3" />
      </div>
      <div className="auth-grid-overlay" />

      {/* Main Glass Auth Card */}
      <div className="auth-card">
        {/* Header Badge */}
        <div style={{ textAlign: 'center' }}>
          <div className="auth-pill-badge">
            <span className="auth-pulse-dot" />
            <span>Live Exam & Evaluation Platform</span>
          </div>
        </div>

        {/* Logo and Titles */}
        <div className="auth-logo">
          <div className="auth-logo-circle">📝</div>
          <h1 className="auth-title text-gradient">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your ExamSite account</p>
        </div>

        {/* Dynamic Mode Switcher (Sign In <-> Create Account) */}
        <div className="auth-nav-toggle">
          <button type="button" className="auth-nav-toggle-btn active">
            <span>🔑</span>
            <span>Sign In</span>
          </button>
          <Link to="/signup" className="auth-nav-toggle-btn">
            <span>✨</span>
            <span>Create Account</span>
          </Link>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email Field with Icon */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <div className="auth-input-wrapper">
              <span className="auth-field-icon">📧</span>
              <input
                id="login-email"
                name="email"
                type="email"
                className="form-input"
                placeholder="you@gmail.com"
                value={form.email}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Password Field with Icon and Toggle */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
              <label className="form-label" htmlFor="login-password" style={{ margin: 0 }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.78rem', color: 'var(--primary-light)', fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>
            <div className="auth-input-wrapper">
              <span className="auth-field-icon">🔒</span>
              <input
                id="login-password"
                name="password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
                style={{ paddingRight: '2.8rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                style={{
                  position: 'absolute', right: '0.85rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  fontSize: '1.1rem', padding: '0.2rem', transition: 'all 0.2s'
                }}
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-full btn-lg btn-auth-submit"
            disabled={loading}
            style={{ marginTop: '0.6rem' }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Signing in…
              </span>
            ) : (
              <span>Sign In to Account →</span>
            )}
          </button>
        </form>

        <hr className="divider" style={{ margin: '1.6rem 0 1.2rem' }} />

        {/* Secondary Portal Access (Signup & Admin Login) */}
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
          {/* Left Button: Create Account */}
          <Link
            id="goto-signup-btn"
            to="/signup"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.75rem 0.85rem',
              borderRadius: '14px',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))',
              color: '#c7d2fe',
              textDecoration: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              transition: 'all 0.25s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.8)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.25)';
            }}
          >
            <span>✨</span>
            <span>New Student?</span>
          </Link>

          {/* Right Button: Admin Login */}
          <Link
            id="goto-admin-btn"
            to="/admin/login"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.75rem 0.85rem',
              borderRadius: '14px',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.1))',
              color: '#fde68a',
              textDecoration: 'none',
              fontSize: '0.82rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              transition: 'all 0.25s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.8)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.35)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.25)';
            }}
          >
            <span>🛡️</span>
            <span>Admin Portal</span>
          </Link>
        </div>

        {/* Feature Highlights Strip */}
        <div className="auth-perks-strip">
          <div className="auth-perk-item">
            <span>⚡</span>
            <span>Instant Results</span>
          </div>
          <div className="auth-perk-item">
            <span>🛡️</span>
            <span>Verified Secure</span>
          </div>
          <div className="auth-perk-item">
            <span>💬</span>
            <span>Authority Chat</span>
          </div>
        </div>
      </div>
    </div>
  );
}
