import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function OTPPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputsRef = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const toast = useToast();

  const { email, name, mode } = location.state || {};

  useEffect(() => {
    if (!email) { navigate('/login'); return; }
    inputsRef.current[0]?.focus();
    const timer = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [email, navigate]);

  const handleChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    if (val && idx < 5) inputsRef.current[idx + 1]?.focus();
    if (next.every((d) => d !== '')) {
      // auto-submit
      setTimeout(() => handleVerify(next.join('')), 100);
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) inputsRef.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) inputsRef.current[idx + 1]?.focus();
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
    if (otpCode.length !== 6) return toast.error('Please enter all 6 digits');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp: otpCode });
      login(res.data.token, res.data.user);
      toast.success('Verified! Welcome to ExamSite 🎉');
      navigate('/profile');
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
      await api.post('/auth/resend-otp', { email });
      toast.success('New OTP sent!');
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass-elevated" style={{maxWidth: 420}}>
        <div className="auth-logo">
          <div className="auth-logo-circle">🔐</div>
          <h1 className="auth-title text-gradient">Verify Email</h1>
          <p className="auth-subtitle">
            We sent a 6-digit OTP to<br />
            <strong style={{color:'var(--primary-light)'}}>{email}</strong>
          </p>
        </div>

        <div className="otp-inputs" onPaste={handlePaste}>
          {otp.map((digit, idx) => (
            <input
              key={idx}
              id={`otp-box-${idx}`}
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
          id="otp-verify-btn"
          className="btn btn-primary btn-full btn-lg"
          onClick={() => handleVerify()}
          disabled={loading || otp.some((d) => !d)}
        >
          {loading
            ? <><span className="spinner" style={{width:18,height:18,borderWidth:2}} /> Verifying…</>
            : '✓ Verify OTP'}
        </button>

        <div className="text-center mt-3" style={{fontSize:'0.875rem', color:'var(--text-muted)'}}>
          {countdown > 0 ? (
            <span>Resend OTP in <strong style={{color:'var(--primary-light)'}}>{countdown}s</strong></span>
          ) : (
            <button
              id="otp-resend-btn"
              className="link-text"
              onClick={handleResend}
              disabled={resending}
              style={{background:'none',border:'none',fontSize:'inherit',cursor:'pointer'}}
            >
              {resending ? 'Sending…' : '↺ Resend OTP'}
            </button>
          )}
        </div>

        <hr className="divider" />
        <p className="text-center" style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>
          Wrong email?{' '}
          <Link to={mode === 'signup' ? '/signup' : '/login'} className="link-text">Go back</Link>
        </p>
      </div>
    </div>
  );
}
