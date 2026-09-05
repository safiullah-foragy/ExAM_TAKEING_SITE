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

  // Dynamic Password Strength Calculation
  const calculatePasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', class: '' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1: return { score: 1, label: 'Weak (min. 6 chars)', class: 'weak' };
      case 2: return { score: 2, label: 'Fair (add numbers/symbols)', class: 'fair' };
      case 3: return { score: 3, label: 'Good password', class: 'good' };
      case 4: return { score: 4, label: 'Excellent & Secure! 🛡️', class: 'strong' };
      default: return { score: 0, label: '', class: '' };
    }
  };

  const strength = calculatePasswordStrength(form.password);

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
      {/* Dynamic Animated Ambient Background */}
      <div className="auth-ambient-glow">
        <div className="auth-blob auth-blob-1" />
        <div className="auth-blob auth-blob-2" />
        <div className="auth-blob auth-blob-3" />
      </div>
      <div className="auth-grid-overlay" />

      {/* Main Glass Auth Card */}
      <div className="auth-card" style={{ maxWidth: 500 }}>
        {/* Header Badge */}
        <div style={{ textAlign: 'center' }}>
          <div className="auth-pill-badge">
            <span className="auth-pulse-dot" />
            <span>Fast & Free Student Registration</span>
          </div>
        </div>

        {/* Logo and Titles */}
        <div className="auth-logo">
          <div className="auth-logo-circle">🎓</div>
          <h1 className="auth-title text-gradient">Create Account</h1>
          <p className="auth-subtitle">Join ExamSite — participate & track results</p>
        </div>

        {/* Dynamic Mode Switcher */}
        <div className="auth-nav-toggle">
          <Link to="/login" className="auth-nav-toggle-btn">
            <span>🔑</span>
            <span>Sign In</span>
          </Link>
          <button type="button" className="auth-nav-toggle-btn active">
            <span>✨</span>
            <span>Create Account</span>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-name">Full Name</label>
            <div className="auth-input-wrapper">
              <span className="auth-field-icon">👤</span>
              <input
                id="signup-name"
                name="name"
                type="text"
                className="form-input"
                placeholder="e.g. Sofi"
                value={form.name}
                onChange={handleChange}
                required
                autoFocus
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">Gmail Address</label>
            <div className="auth-input-wrapper">
              <span className="auth-field-icon">📧</span>
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
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span>ℹ️</span> An OTP code will be sent to verify your Gmail.
            </p>
          </div>

          {/* Password with Strength Meter */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">Create Password</label>
            <div className="auth-input-wrapper">
              <span className="auth-field-icon">🔒</span>
              <input
                id="signup-password"
                name="password"
                type={showPass ? 'text' : 'password'}
                className="form-input"
                placeholder="Min. 6 characters"
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

            {/* Dynamic Password Strength Indicator */}
            {form.password && (
              <div className="password-meter-wrap">
                <div className="password-meter-bars">
                  <div className={`password-meter-segment ${strength.score >= 1 ? strength.class : ''}`} />
                  <div className={`password-meter-segment ${strength.score >= 2 ? strength.class : ''}`} />
                  <div className={`password-meter-segment ${strength.score >= 3 ? strength.class : ''}`} />
                  <div className={`password-meter-segment ${strength.score >= 4 ? strength.class : ''}`} />
                </div>
                <div className="password-meter-label">
                  <span>Strength: {strength.label}</span>
                  <span>{strength.score}/4</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="signup-confirm-password">Confirm Password</label>
            <div className="auth-input-wrapper">
              <span className="auth-field-icon">🔐</span>
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
            </div>
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p style={{ fontSize: '0.75rem', color: 'var(--accent-red)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span>✕</span> Passwords do not match yet
              </p>
            )}
            {form.confirmPassword && form.password === form.confirmPassword && form.password && (
              <p style={{ fontSize: '0.75rem', color: 'var(--accent-green)', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span>✓</span> Passwords match perfectly!
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            id="signup-submit-btn"
            type="submit"
            className="btn btn-full btn-lg btn-auth-submit"
            disabled={loading}
            style={{ marginTop: '0.75rem' }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Creating your account…
              </span>
            ) : (
              <span>Create Account & Get OTP →</span>
            )}
          </button>
        </form>

        <hr className="divider" style={{ margin: '1.6rem 0 1.2rem' }} />

        {/* Footer Link */}
        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary-light)', fontWeight: 700, textDecoration: 'none' }}>
            Sign In Here →
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
