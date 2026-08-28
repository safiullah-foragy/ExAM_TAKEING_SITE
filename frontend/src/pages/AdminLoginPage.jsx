import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';

export default function AdminLoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
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
      <div className="auth-card glass-elevated">
        <div className="auth-logo">
          <div className="auth-logo-circle" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>🛡️</div>
          <h1 className="auth-title" style={{background:'linear-gradient(135deg,#fbbf24,#f59e0b)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>
            Admin Portal
          </h1>
          <p className="auth-subtitle">ExamSite Administration Panel</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-email">Admin Email</label>
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
          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          <button
            id="admin-login-btn"
            type="submit"
            className="btn btn-full btn-lg"
            disabled={loading}
            style={{background:'linear-gradient(135deg,#f59e0b,#d97706)', color:'#000', fontWeight:700}}
          >
            {loading ? 'Authenticating…' : '→ Login as Admin'}
          </button>
        </form>

        <hr className="divider" />
        
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
          <Link
            id="back-to-user-login-btn"
            to="/login"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.8rem 1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))',
              color: '#c7d2fe',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: 600,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)',
              textAlign: 'center',
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
            <span>←</span>
            <span>Back to User Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
