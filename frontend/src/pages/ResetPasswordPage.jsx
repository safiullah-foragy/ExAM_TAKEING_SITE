import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

// ── Step 1: OTP verification ──────────────────────────────────────────────────
function OTPStep({ email, onVerified }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputsRef = useRef([]);
  const toast = useToast();

  useEffect(() => {
    inputsRef.current[0]?.focus();
    const timer = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputsRef.current[idx + 1]?.focus();
    if (next.every((d) => d !== '')) setTimeout(() => handleVerify(next.join('')), 100);
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) inputsRef.current[idx - 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      setTimeout(() => handleVerify(pasted), 100);
    }
  };

  const handleVerify = async (code) => {
    if (loading) return;
    const otpCode = code || otp.join('');
    if (otpCode.length !== 6) return toast.error('Enter all 6 digits');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-forgot-otp', { email, otp: otpCode });
      toast.success('OTP verified ✓');
      onVerified(res.data.resetToken);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('New OTP sent!');
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <div className="auth-logo">
        <div className="auth-logo-circle" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>🔐</div>
        <h1 className="auth-title" style={{
          background: 'linear-gradient(135deg,#fbbf24,#a78bfa)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>Verify OTP</h1>
        <p className="auth-subtitle">
          OTP sent to <strong style={{ color: 'var(--primary-light)' }}>{email}</strong>
        </p>
      </div>

      <div className="otp-inputs" onPaste={handlePaste}>
        {otp.map((digit, idx) => (
          <input
            key={idx}
            id={`reset-otp-${idx}`}
            ref={(el) => (inputsRef.current[idx] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className={`otp-box${digit ? ' filled' : ''}`}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
          />
        ))}
      </div>

      <button
        id="reset-otp-verify-btn"
        className="btn btn-full btn-lg"
        onClick={() => handleVerify()}
        disabled={loading || otp.some((d) => !d)}
        style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000', fontWeight: 700 }}
      >
        {loading ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Verifying…</> : '✓ Verify OTP'}
      </button>

      <div className="text-center mt-3" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        {countdown > 0
          ? <span>Resend in <strong style={{ color: 'var(--primary-light)' }}>{countdown}s</strong></span>
          : <button
              id="reset-resend-btn"
              onClick={handleResend}
              disabled={resending}
              style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontWeight: 600 }}
            >{resending ? 'Sending…' : '↺ Resend OTP'}</button>
        }
      </div>
    </>
  );
}

// ── Step 2: New password form ─────────────────────────────────────────────────
function ResetStep({ resetToken }) {
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    if (form.newPassword !== form.confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { resetToken, newPassword: form.newPassword });
      toast.success('Password reset successful! 🎉');
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
        <h2 style={{ marginBottom: '0.5rem' }}>Password Reset!</h2>
        <p style={{ color: 'var(--text-muted)' }}>Redirecting to login…</p>
      </div>
    );
  }

  return (
    <>
      <div className="auth-logo">
        <div className="auth-logo-circle" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>🔒</div>
        <h1 className="auth-title text-gradient">Set New Password</h1>
        <p className="auth-subtitle">Choose a strong password for your account</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="new-password">New Password</label>
          <div style={{ position: 'relative' }}>
            <input
              id="new-password"
              type={showPass ? 'text' : 'password'}
              className="form-input"
              placeholder="Min. 6 characters"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              required
              autoFocus
              style={{ paddingRight: '3rem' }}
            />
            <button type="button" onClick={() => setShowPass((s) => !s)} style={{
              position: 'absolute', right: '0.875rem', top: '50%',
              transform: 'translateY(-50%)', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem'
            }}>{showPass ? '🙈' : '👁️'}</button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirm-new-password">Confirm New Password</label>
          <input
            id="confirm-new-password"
            type={showPass ? 'text' : 'password'}
            className="form-input"
            placeholder="Re-enter new password"
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            required
          />
          {form.confirmPassword && (
            <p style={{
              fontSize: '0.75rem', marginTop: '0.3rem',
              color: form.newPassword === form.confirmPassword ? 'var(--accent-green)' : 'var(--accent-red)'
            }}>
              {form.newPassword === form.confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
            </p>
          )}
        </div>

        <button
          id="reset-password-btn"
          type="submit"
          className="btn btn-success btn-full btn-lg"
          disabled={loading}
        >
          {loading
            ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Resetting…</>
            : '✓ Reset Password'}
        </button>
      </form>
    </>
  );
}

// ── Main page — combines both steps ──────────────────────────────────────────
export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  const [resetToken, setResetToken] = useState(null);

  useEffect(() => {
    if (!email) navigate('/forgot-password');
  }, [email, navigate]);

  if (!email) return null;

  return (
    <div className="auth-page">
      <div className="auth-card glass-elevated">
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
          {['Verify OTP', 'New Password'].map((step, idx) => {
            const active = (idx === 0 && !resetToken) || (idx === 1 && !!resetToken);
            const done = idx === 0 && !!resetToken;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: done ? 'var(--accent-green)' : active ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, color: '#fff',
                  border: active ? '2px solid var(--primary-light)' : '2px solid transparent',
                  transition: 'all 0.3s'
                }}>
                  {done ? '✓' : idx + 1}
                </div>
                <span style={{
                  fontSize: '0.8rem',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 400
                }}>{step}</span>
                {idx === 0 && <span style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>→</span>}
              </div>
            );
          })}
        </div>

        {!resetToken
          ? <OTPStep email={email} onVerified={setResetToken} />
          : <ResetStep resetToken={resetToken} />
        }

        <hr className="divider" />
        <p className="text-center" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <Link to="/login" className="link-text">← Back to Login</Link>
        </p>
      </div>
    </div>
  );
}
