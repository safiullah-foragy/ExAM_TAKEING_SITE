import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error('Please enter your email');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      toast.success('OTP sent! Check your email 📧');
      navigate('/reset-otp', { state: { email: email.trim() } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-elevated">
        <div className="auth-logo">
          <div className="auth-logo-circle" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            🔑
          </div>
          <h1 className="auth-title" style={{
            background: 'linear-gradient(135deg,#fbbf24,#a78bfa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            Forgot Password
          </h1>
          <p className="auth-subtitle">Enter your email — we'll send an OTP to reset your password</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="forgot-email">Gmail Address</label>
            <input
              id="forgot-email"
              type="email"
              className="form-input"
              placeholder="you@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <button
            id="forgot-send-btn"
            type="submit"
            className="btn btn-full btn-lg"
            disabled={loading}
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000', fontWeight: 700 }}
          >
            {loading
              ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Sending OTP…</>
              : '→ Send OTP'}
          </button>
        </form>

        <hr className="divider" />
        <p className="text-center" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Remember your password?{' '}
          <Link to="/login" className="link-text">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
