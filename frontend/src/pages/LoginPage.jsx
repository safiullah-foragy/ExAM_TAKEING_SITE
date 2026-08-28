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
      <div className="auth-card glass-elevated">
        <div className="auth-logo">
          <div className="auth-logo-circle">📝</div>
          <h1 className="auth-title text-gradient">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to your ExamSite account</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
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

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" htmlFor="login-password" style={{ margin: 0 }}>Password</label>
              <Link to="/forgot-password" style={{ fontSize: '0.78rem', color: 'var(--primary-light)', fontWeight: 600 }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                name="password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                style={{
                  position: 'absolute', right: '0.875rem', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  fontSize: '1rem'
                }}
              >{showPass ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Signing in…</>
              : '→ Sign In'}
          </button>
        </form>

        <hr className="divider" />
        
        <div style={{
          display: 'flex',
          gap: '0.875rem',
          marginTop: '1.25rem',
          width: '100%'
        }}>
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
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))',
              color: '#c7d2fe',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.8)';
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.2))';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))';
            }}
          >
            <span>✨</span>
            <span>Create Account</span>
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
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.1))',
              color: '#fde68a',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.8)';
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.2))';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.1))';
            }}
          >
            <span>🛡️</span>
            <span>Admin Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
