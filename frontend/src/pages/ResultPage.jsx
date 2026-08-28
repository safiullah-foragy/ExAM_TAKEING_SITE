import { useLocation, useNavigate } from 'react-router-dom';

export default function ResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const result = state?.result;
  const examTitle = state?.examTitle || 'Exam';

  if (!result) {
    navigate('/profile');
    return null;
  }

  const pct = Math.round((result.score / result.totalMarks) * 100);
  const passPct = Math.round((result.passMarks / result.totalMarks) * 100);
  const circumference = 2 * Math.PI * 60;
  const strokeDash = (pct / 100) * circumference;
  const passColor = result.passed ? '#10b981' : '#ef4444';

  return (
    <div className="result-page">
      <div className="result-card glass-elevated" style={{padding:'2.5rem'}}>
        {/* Header */}
        <div style={{
          background: result.passed
            ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))'
            : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))',
          border: `1px solid ${passColor}40`,
          borderRadius:'var(--radius-lg)',
          padding:'1.5rem',
          marginBottom:'1.5rem'
        }}>
          <div style={{fontSize:'3rem', marginBottom:'0.5rem'}}>
            {result.passed ? '🎉' : '📚'}
          </div>
          <h1 style={{fontSize:'1.6rem', marginBottom:'0.25rem', color: passColor}}>
            {result.passed ? 'Congratulations!' : 'Keep Practicing!'}
          </h1>
          <p style={{color:'var(--text-muted)', fontSize:'0.9rem'}}>{examTitle}</p>
        </div>

        {/* Score Ring */}
        <div className="score-ring">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
            <circle
              cx="80" cy="80" r="60"
              fill="none"
              stroke={passColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${strokeDash} ${circumference}`}
              style={{transition:'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)'}}
            />
            {/* Pass threshold marker */}
            <circle
              cx="80" cy="80" r="60"
              fill="none"
              stroke="rgba(245,158,11,0.5)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`2 ${circumference - 2}`}
              strokeDashoffset={-(passPct / 100) * circumference}
            />
          </svg>
          <div className="score-ring-inner">
            <span className="score-number" style={{color: passColor}}>{result.score}</span>
            <span className="score-label">/ {result.totalMarks}</span>
          </div>
        </div>

        {/* Pass/Fail Badge */}
        <div style={{marginBottom:'1.5rem'}}>
          <span className={`badge ${result.passed ? 'badge-success' : 'badge-danger'}`}
            style={{fontSize:'0.9rem', padding:'0.5rem 1.5rem'}}>
            {result.passed ? '● PASSED' : '● FAILED'}
          </span>
          <p style={{fontSize:'0.8rem', color:'var(--text-muted)', marginTop:'0.5rem'}}>
            Pass mark: {result.passMarks} — Your score: {result.score}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="result-stats">
          <div className="result-stat">
            <div className="result-stat-value" style={{color:'var(--accent-green)'}}>{result.correct}</div>
            <div className="result-stat-label">✓ Correct</div>
          </div>
          <div className="result-stat">
            <div className="result-stat-value" style={{color:'var(--accent-red)'}}>{result.wrong}</div>
            <div className="result-stat-label">✗ Wrong</div>
          </div>
          <div className="result-stat">
            <div className="result-stat-value" style={{color:'var(--text-muted)'}}>{result.skipped}</div>
            <div className="result-stat-label">— Skipped</div>
          </div>
        </div>

        <p style={{fontSize:'0.85rem', color:'var(--text-muted)', margin:'1rem 0 1.5rem',
          background:'rgba(99,102,241,0.08)', padding:'0.75rem 1rem', borderRadius:'var(--radius-md)',
          border:'1px solid var(--border)'}}>
          📧 Your detailed result sheet has been sent to your email as a PDF attachment.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            id="back-to-profile-btn"
            className="btn btn-outline btn-full"
            onClick={() => navigate('/profile')}
          >
            ← Back to Profile
          </button>
          <button
            id="retake-exam-btn"
            className="btn btn-primary btn-full"
            onClick={() => {
              // Clear cached answers for this exam before retake
              const examId = window.location.pathname.split('/').pop();
              if (examId) localStorage.removeItem(`exam_answers_${examId}`);
              navigate(`/exam/${examId}`);
            }}
          >
            ↺ Retake Exam
          </button>
        </div>
      </div>
    </div>
  );
}
