import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.confirmPassword) {
      return toast.error('All fields are required');
    }
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setLoading(true);
    try {
      await api.post('/auth/signup', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      toast.success('OTP sent to your Gmail! 📧');
      navigate('/verify-otp', {
        state: { email: form.email.trim(), name: form.name.trim(), mode: 'signup' },
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-elevated">
        <div className="auth-logo">
          <div className="auth-logo-circle">🎓</div>
          <h1 className="auth-title text-gradient">Create Account</h1>
          <p className="auth-subtitle">Join ExamSite — free & quick</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full Name</label>
            <input
              id="signup-name"
              name="name"
              type="text"
              className="form-input"
              placeholder="Your full name"
              value={form.name}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Gmail Address</label>
            <input
              id="signup-email"
              name="email"
              type="email"
              className="form-input"
              placeholder="you@gmail.com"
              value={form.email}
              onChange={handleChange}
              required
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              📧 An OTP will be sent to verify your email
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-password"
                name="password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="Min. 6 characters"
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
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem'
                }}
              >{showPass ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm-password">Confirm Password</label>
            <input
              id="signup-confirm-password"
              name="confirmPassword"
              type={showPass ? 'text' : 'password'}
              className="form-input"
              placeholder="Re-enter password"
              value={form.confirmPassword}
              onChange={handleChange}
              required
            />
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.3rem' }}>
                ✕ Passwords do not match
              </p>
            )}
            {form.confirmPassword && form.password === form.confirmPassword && form.password && (
              <p style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: '0.3rem' }}>
                ✓ Passwords match
              </p>
            )}
          </div>

          <button
            id="signup-submit-btn"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading
              ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Sending OTP…</>
              : '→ Sign Up & Verify Email'}
          </button>
        </form>

        <hr className="divider" />
        <p className="text-center" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" className="link-text">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
