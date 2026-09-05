import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';

export default function AdminLoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/admin/login', form);
      localStorage.setItem('adminToken', res.data.token);
      toast.success('Welcome, Admin! 🛡️');
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Dynamic Ambient Background with Golden Amber Accents */}
      <div className="auth-ambient-glow">
        <div className="auth-blob auth-blob-1 auth-blob-amber" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-blob auth-blob-3 auth-blob-amber" />
      </div>
      <div className="auth-grid-overlay" />

      {/* Main Glass Card */}
      <div className="auth-card" style={{ maxWidth: 460 }}>
        {/* Header Pill Badge */}
        <div style={{ textAlign: 'center' }}>
          <div
            className="auth-pill-badge"
            style={{
              background: 'rgba(245, 158, 11, 0.12)',
              borderColor: 'rgba(245, 158, 11, 0.4)',
              color: '#fde68a'
            }}
          >
            <span className="auth-pulse-dot" style={{ background: '#f59e0b', boxShadow: '0 0 10px #f59e0b' }} />
            <span>Authorized Examination Authority</span>
          </div>
        </div>

        {/* Logo and Titles */}
        <div className="auth-logo">
          <div
            className="auth-logo-circle"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706, #b45309)',
              boxShadow: '0 0 35px rgba(245, 158, 11, 0.45)'
            }}
          >
            🛡️
          </div>
          <h1
            className="auth-title"
            style={{
              background: 'linear-gradient(135deg, #fef08a, #f59e0b)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Admin Portal
          </h1>
          <p className="auth-subtitle">ExamSite System Administration</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Admin Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="admin-email">Admin Email</label>
            <div className="auth-input-wrapper">
              <span className="auth-field-icon">🛡️</span>
              <input
                id="admin-email"
                name="email"
                type="email"
                className="form-input"
                placeholder="admin@examsite.com"
                value={form.email}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">Password</label>
            <div className="auth-input-wrapper">
              <span className="auth-field-icon">🔒</span>
              <input
                id="admin-password"
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
            id="admin-login-btn"
            type="submit"
            className="btn btn-full btn-lg"
            disabled={loading}
            style={{
              marginTop: '0.75rem',
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)',
              color: '#0f0f1e',
              fontWeight: 800,
              boxShadow: '0 8px 25px rgba(245, 158, 11, 0.4)',
              border: 'none',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: '#000', borderTopColor: 'transparent' }} />
                Authenticating…
              </span>
            ) : (
              'Enter Admin Panel →'
            )}
          </button>
        </form>

        <hr className="divider" style={{ margin: '1.8rem 0 1.3rem' }} />

        {/* Back to Student Login */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link
            id="back-to-user-login-btn"
            to="/login"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.8rem 1.2rem',
              borderRadius: '14px',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))',
              color: '#c7d2fe',
              textDecoration: 'none',
              fontSize: '0.88rem',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              transition: 'all 0.25s ease',
              textAlign: 'center',
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
            <span>←</span>
            <span>Back to Student Portal</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
