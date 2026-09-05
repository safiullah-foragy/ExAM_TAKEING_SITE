import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { API_ORIGIN } from '../utils/api';
import { useToast } from '../context/ToastContext';
import PDFViewer from '../components/PDFViewer';

const OPTIONS = ['ক', 'খ', 'গ', 'ঘ'];

// Convert number to Bangla numeral string
const toBanglaNumeral = (n) => {
  const map = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(n).replace(/\d/g, (d) => map[parseInt(d)]);
};

export default function ExamReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'correct' | 'wrong' | 'skipped'
  const [mobileView, setMobileView] = useState('split'); // 'split' | 'solutions' | 'pdf'
  const [showNotice, setShowNotice] = useState(true);

  useEffect(() => {
    const fetchReview = async () => {
      try {
        const res = await api.get(`/exam/${id}/review`);
        setData(res.data);
      } catch (err) {
        const msg = err.response?.data?.message || 'Failed to load exam review';
        toast.error(msg);
        navigate('/profile');
      } finally {
        setLoading(false);
      }
    };
    fetchReview();
  }, [id, navigate, toast]);

  const exam = data?.exam;
  const submission = data?.submission;

  // Build lookup maps
  const userAnswersMap = useMemo(() => {
    if (!submission?.answers) return {};
    const map = {};
    submission.answers.forEach((a) => {
      map[a.questionNo] = a.selectedAnswer;
    });
    return map;
  }, [submission]);

  const correctAnswersMap = useMemo(() => {
    if (!exam?.answerKey) return {};
    const map = {};
    exam.answerKey.forEach((k) => {
      map[k.questionNo] = k.answer;
    });
    return map;
  }, [exam]);

  // Build question review items
  const questionItems = useMemo(() => {
    if (!exam?.totalQuestions) return [];
    const items = [];
    for (let qNo = 1; qNo <= exam.totalQuestions; qNo++) {
      const userAns = userAnswersMap[qNo] || null;
      const correctAns = correctAnswersMap[qNo] || null;

      let status = 'skipped';
      if (userAns) {
        status = userAns === correctAns ? 'correct' : 'wrong';
      }

      items.push({
        questionNo: qNo,
        userAns,
        correctAns,
        status,
      });
    }
    return items;
  }, [exam, userAnswersMap, correctAnswersMap]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (filter === 'correct') return questionItems.filter((q) => q.status === 'correct');
    if (filter === 'wrong') return questionItems.filter((q) => q.status === 'wrong');
    if (filter === 'skipped') return questionItems.filter((q) => q.status === 'skipped');
    return questionItems;
  }, [questionItems, filter]);

  if (loading) {
    return (
      <div className="loader-wrap" style={{ height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!exam || !submission) return null;

  const formatPdfUrl = (url, examId) => {
    const token = localStorage.getItem('token');
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';

    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      return url;
    }

    const cleanPath = url && url.startsWith('/api/') ? url : `/api/exam/${examId}/pdf`;
    const base = API_ORIGIN ? `${API_ORIGIN}${cleanPath}` : cleanPath;
    return `${base}${tokenParam}`;
  };

  const pdfUrl = formatPdfUrl(exam.pdfUrl, exam._id);

  const handleRetake = () => {
    localStorage.removeItem(`exam_answers_${exam._id}`);
    navigate(`/exam/${exam._id}`);
  };

  return (
    <div className={`review-page mobile-mode-${mobileView}`}>
      {/* Top Bar */}
      <div className="review-topbar">
        <div className="review-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
          <button
            id="review-back-btn"
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/profile')}
            title="Return to Dashboard"
          >
            ← Back
          </button>
          <div className="review-topbar-title">
            <span>📝</span>
            <span className="review-title-text" title={exam.title}>
              {exam.title}
            </span>
          </div>
        </div>

        {/* Stats and Action Header */}
        <div className="review-header-stats">
          <span className="badge badge-primary badge-attempt" title="Evaluation is locked to your 1st exam attempt">
            ⭐ 1st Attempt
          </span>
          <span className={`badge ${submission.passed ? 'badge-success' : 'badge-danger'}`}>
            {submission.passed ? '✓ Passed' : '✗ Failed'} ({submission.score}/{exam.totalMarks})
          </span>
          <button
            id="review-retake-btn"
            className="btn btn-primary btn-sm review-topbar-retake"
            onClick={handleRetake}
          >
            ↺ Retake
          </button>
        </div>
      </div>

      {/* Mobile View Switcher Tabs (visible on mobile only) */}
      <div className="mobile-view-tabs" role="tablist" aria-label="Review view mode">
        <button
          type="button"
          className={`mobile-view-tab ${mobileView === 'solutions' ? 'active' : ''}`}
          onClick={() => setMobileView('solutions')}
          title="Show solutions in full screen"
        >
          <span>📋</span> Solutions & Key ({submission.correct}/{exam.totalQuestions})
        </button>
        <button
          type="button"
          className={`mobile-view-tab ${mobileView === 'split' ? 'active' : ''}`}
          onClick={() => setMobileView('split')}
          title="Show both question paper and solutions"
        >
          <span>◫</span> Split View
        </button>
        <button
          type="button"
          className={`mobile-view-tab ${mobileView === 'pdf' ? 'active' : ''}`}
          onClick={() => setMobileView('pdf')}
          title="Show question paper in full screen"
        >
          <span>📄</span> Question Paper
        </button>
      </div>

      {/* Main Body */}
      <div className={`exam-body review-exam-body mobile-view-${mobileView}`}>
        {/* Left Pane: Question Paper PDF */}
        <div className="exam-pdf-pane review-pdf-pane">
          <PDFViewer pdfUrl={pdfUrl} />
        </div>

        {/* Right Pane: Solutions & Answers */}
        <div className="exam-answer-pane review-answer-pane">
          {/* Header & Filter Controls */}
          <div className="review-pane-header">
            <div className="review-pane-header-row">
              <div className="review-pane-heading">
                <span className="review-heading-title">📋 Answer Key & Solutions</span>
                <span className="review-heading-score">
                  {submission.correct}/{exam.totalQuestions} Correct
                </span>
              </div>
              <div className="review-pane-header-actions">
                <button
                  type="button"
                  className="btn btn-outline btn-xs mobile-expand-toggle"
                  onClick={() => setMobileView(mobileView === 'solutions' ? 'split' : 'solutions')}
                  title={mobileView === 'solutions' ? 'Switch to split view' : 'Expand solutions to full screen'}
                >
                  {mobileView === 'solutions' ? '⤡ Split View' : '⤢ Full View'}
                </button>
              </div>
            </div>

            {/* Official 1st attempt note */}
            {showNotice && (
              <div className="review-attempt-notice">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                  <span>📌</span>
                  <span>
                    Answers from <strong>1st official exam attempt</strong>. Retakes are practice.
                  </span>
                </div>
                <button
                  type="button"
                  className="notice-dismiss-btn"
                  onClick={() => setShowNotice(false)}
                  title="Dismiss note"
                  aria-label="Dismiss note"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Filter Pills */}
            <div className="review-filter-tabs">
              <button
                className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({questionItems.length})
              </button>
              <button
                className={`filter-chip chip-correct ${filter === 'correct' ? 'active' : ''}`}
                onClick={() => setFilter('correct')}
              >
                ✓ Correct ({submission.correct})
              </button>
              <button
                className={`filter-chip chip-wrong ${filter === 'wrong' ? 'active' : ''}`}
                onClick={() => setFilter('wrong')}
              >
                ✗ Wrong ({submission.wrong})
              </button>
              <button
                className={`filter-chip chip-skipped ${filter === 'skipped' ? 'active' : ''}`}
                onClick={() => setFilter('skipped')}
              >
                — Skipped ({submission.skipped})
              </button>
            </div>
          </div>

          {/* Solution Sheet List */}
          <div className="review-sheet">
            {filteredItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                No questions in this filter category.
              </div>
            ) : (
              filteredItems.map(({ questionNo, userAns, correctAns, status }) => (
                <div key={questionNo} className={`review-q-card status-${status}`}>
                  <div className="review-q-header">
                    <div className="review-q-num">
                      প্রশ্ন নং {toBanglaNumeral(questionNo)}
                    </div>
                    <div>
                      {status === 'correct' && (
                        <span className="review-status-pill pill-correct">✓ Correct (+{exam.marksPerMCQ})</span>
                      )}
                      {status === 'wrong' && (
                        <span className="review-status-pill pill-wrong">
                          ✗ Wrong {exam.negativeMark ? `(-${exam.negativeMark})` : ''}
                        </span>
                      )}
                      {status === 'skipped' && (
                        <span className="review-status-pill pill-skipped">— Not Attempted</span>
                      )}
                    </div>
                  </div>

                  {/* 4 MCQ Option Boxes */}
                  <div className="review-options">
                    {OPTIONS.map((opt) => {
                      const isCorrect = opt === correctAns;
                      const isUserSelected = opt === userAns;

                      let optClass = 'review-opt';
                      if (isUserSelected && isCorrect) {
                        optClass += ' user-correct';
                      } else if (isUserSelected && !isCorrect) {
                        optClass += ' user-wrong';
                      } else if (isCorrect) {
                        optClass += ' correct-key';
                      } else {
                        optClass += ' dimmed';
                      }

                      return (
                        <div
                          key={opt}
                          className={optClass}
                          title={
                            isCorrect && isUserSelected
                              ? 'Your answer (Correct ✓)'
                              : isUserSelected
                              ? 'Your answer (Wrong ✗)'
                              : isCorrect
                              ? 'Correct answer key'
                              : opt
                          }
                        >
                          {opt}
                          {isUserSelected && isCorrect && (
                            <span style={{ fontSize: '0.68rem', marginLeft: '3px' }}>✓</span>
                          )}
                          {isUserSelected && !isCorrect && (
                            <span style={{ fontSize: '0.68rem', marginLeft: '3px' }}>✗</span>
                          )}
                          {!isUserSelected && isCorrect && (
                            <span style={{ fontSize: '0.68rem', marginLeft: '3px' }}>★</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Clarification Label */}
                  <div className="review-answer-details">
                    <span>
                      Your Answer:{' '}
                      <strong style={{ color: status === 'correct' ? '#34d399' : status === 'wrong' ? '#f87171' : 'var(--text-muted)' }}>
                        {userAns || 'None (Skipped)'}
                      </strong>
                    </span>
                    <span>
                      Correct Answer:{' '}
                      <strong style={{ color: '#34d399' }}>{correctAns || 'N/A'}</strong>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer note and legend */}
          <div className="answer-pane-footer review-pane-footer">
            <div className="review-legend-row">
              <span style={{ color: '#34d399' }}>● Correct Answer</span>
              <span style={{ color: '#f87171' }}>● Wrong Selected</span>
              <span style={{ color: '#94a3b8' }}>○ Skipped</span>
            </div>
            <button
              id="review-retake-footer-btn"
              className="btn btn-primary btn-full review-retake-footer-btn"
              onClick={handleRetake}
            >
              ↺ Retake This Exam
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
