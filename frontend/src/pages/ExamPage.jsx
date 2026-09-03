import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { API_ORIGIN } from '../utils/api';
import { useToast } from '../context/ToastContext';
import PDFViewer from '../components/PDFViewer';
import AnswerSheet from '../components/AnswerSheet';
import CountdownTimer from '../components/CountdownTimer';

const CACHE_KEY = (examId) => `exam_answers_${examId}`;

export default function ExamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({}); // { questionNo: 'ক'/'খ'/'গ'/'ঘ' }
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const [showConfirm, setShowConfirm] = useState(false);
  const hasSubmitted = useRef(false);

  // Load cached answers from localStorage
  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY(id));
    if (cached) {
      try { setAnswers(JSON.parse(cached)); } catch { /* ignore */ }
    }
  }, [id]);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const res = await api.get(`/exam/${id}`);
        setExam(res.data.exam);
      } catch (err) {
        toast.error('Failed to load exam');
        navigate('/profile');
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [id, navigate, toast]);

  // Save answers to localStorage whenever they change
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(CACHE_KEY(id), JSON.stringify(answers));
    }
  }, [answers, id]);

  const handleAnswer = useCallback((questionNo, answer) => {
    setAnswers((prev) => {
      if (prev[questionNo] === answer) {
        // Deselect if same
        const next = { ...prev };
        delete next[questionNo];
        return next;
      }
      return { ...prev, [questionNo]: answer };
    });
  }, []);

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (hasSubmitted.current) return;
    if (!autoSubmit && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    hasSubmitted.current = true;
    setSubmitting(true);

    const timeTakenSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Convert answers object to array
    const answersArray = Object.entries(answers).map(([qNo, sel]) => ({
      questionNo: parseInt(qNo),
      selectedAnswer: sel,
    }));

    try {
      const res = await api.post(`/exam/${id}/submit`, {
        answers: answersArray,
        timeTaken: timeTakenSeconds,
      });
      // Clear cache
      localStorage.removeItem(CACHE_KEY(id));
      toast.success('Exam submitted! Check your email for results 📧');
      navigate(`/result/${id}`, { state: { result: res.data.result, examTitle: exam.title } });
    } catch (err) {
      hasSubmitted.current = false;
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }, [answers, exam, id, navigate, showConfirm, startTime, toast]);

  // Auto-submit when timer expires
  const handleTimeUp = useCallback(() => {
    if (!hasSubmitted.current) {
      toast.info('Time is up! Auto-submitting…');
      handleSubmit(true);
    }
  }, [handleSubmit, toast]);

  if (loading) {
    return <div className="loader-wrap" style={{height:'100vh'}}><div className="spinner" /></div>;
  }

  if (!exam) return null;

  const answeredCount = Object.keys(answers).length;
  const totalQ = exam.totalQuestions;
  const formatPdfUrl = (url, examId) => {
    if (!url && examId) return API_ORIGIN ? `${API_ORIGIN}/api/exam/${examId}/pdf` : `/api/exam/${examId}/pdf`;
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return API_ORIGIN ? `${API_ORIGIN}${cleanUrl}` : cleanUrl;
  };
  const pdfUrl = formatPdfUrl(exam.pdfUrl, exam._id);

  return (
    <div className="exam-page">
      {/* Top Bar */}
      <div className="exam-topbar">
        <div className="exam-title-bar">📝 {exam.title}</div>
        <CountdownTimer
          totalSeconds={exam.totalTime * 60}
          onTimeUp={handleTimeUp}
        />
        <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
          <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>
            {answeredCount}/{totalQ} answered
          </span>
          <button
            id="submit-exam-btn"
            className="btn btn-success btn-sm"
            onClick={() => handleSubmit(false)}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : '✓ Submit Exam'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="exam-body">
        {/* PDF Pane */}
        <div className="exam-pdf-pane">
          <PDFViewer pdfUrl={pdfUrl} />
        </div>

        {/* Answer Sheet Pane */}
        <div className="exam-answer-pane">
          <div className="answer-pane-header">
            📋 Answer Sheet
            <span style={{
              marginLeft:'auto', display:'inline-block',
              fontSize:'0.75rem', color:'var(--primary-light)',
              background:'rgba(99,102,241,0.12)',
              padding:'2px 8px', borderRadius:'999px'
            }}>
              {answeredCount}/{totalQ}
            </span>
          </div>
          <div className="answer-sheet">
            <AnswerSheet
              totalQuestions={totalQ}
              answers={answers}
              onAnswer={handleAnswer}
            />
          </div>
          <div className="answer-pane-footer">
            <div style={{
              fontSize:'0.75rem', color:'var(--text-muted)',
              marginBottom:'0.625rem',
              display:'flex', gap:'1rem'
            }}>
              <span style={{color:'var(--accent-green)'}}>● Selected</span>
              <span style={{color:'var(--text-muted)'}}>○ Unanswered</span>
            </div>
            <button
              id="submit-exam-footer-btn"
              className="btn btn-primary btn-full"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : '✓ Submit Exam'}
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
          display:'flex', alignItems:'center', justifyContent:'center',
          zIndex:1000, backdropFilter:'blur(4px)'
        }}>
          <div className="glass-elevated" style={{padding:'2rem', maxWidth:400, width:'90%', textAlign:'center'}}>
            <div style={{fontSize:'3rem', marginBottom:'1rem'}}>⚠️</div>
            <h3 style={{marginBottom:'0.5rem'}}>Submit Exam?</h3>
            <p style={{marginBottom:'0.25rem', color:'var(--text-secondary)'}}>
              You answered <strong style={{color:'var(--primary-light)'}}>{answeredCount}</strong> out of <strong>{totalQ}</strong> questions.
            </p>
            {answeredCount < totalQ && (
              <p style={{color:'var(--accent-amber)', fontSize:'0.85rem', marginBottom:'1rem'}}>
                ⚠️ {totalQ - answeredCount} questions unanswered
              </p>
            )}
            <div style={{display:'flex', gap:'0.75rem', justifyContent:'center', marginTop:'1.5rem'}}>
              <button
                id="confirm-cancel-btn"
                className="btn btn-outline"
                onClick={() => setShowConfirm(false)}
              >Cancel</button>
              <button
                id="confirm-submit-btn"
                className="btn btn-success"
                onClick={() => handleSubmit(true)}
                disabled={submitting}
              >
                {submitting ? 'Submitting…' : '✓ Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
