import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_ORIGIN } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const BASE_URL = API_ORIGIN || 'http://localhost:5000';

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [participationModalExam, setParticipationModalExam] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const fileRef = useRef();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/user/profile');
        setProfile(res.data.user);
      } catch { toast.error('Failed to load profile'); }
    };
    const fetchExams = async () => {
      try {
        const res = await api.get('/exam');
        setExams(res.data.exams);
      } catch { toast.error('Failed to load exams'); }
      finally { setLoading(false); }
    };
    const fetchUnread = async () => {
      try {
        const res = await api.get('/chat/unread-count');
        setUnreadCount(res.data.unreadCount || 0);
      } catch {}
    };

    fetchProfile();
    fetchExams();
    fetchUnread();

    const interval = setInterval(fetchUnread, 5000);
    return () => clearInterval(interval);
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.put('/user/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const photoUrl = res.data.photo;
      updateUser({ photo: photoUrl });
      setProfile((p) => ({ ...p, photo: photoUrl }));
      toast.success('Profile photo updated!');
    } catch { toast.error('Photo upload failed'); }
    finally { setUploading(false); }
  };

  const handleExamClick = (exam) => {
    navigate(`/exam/${exam._id}`);
  };

  const handleViewAnswers = (exam) => {
    if (exam.alreadySubmitted) {
      navigate(`/exam/${exam._id}/review`);
    } else {
      toast.info('Please first participate in the exam to view answers and solutions.');
      setParticipationModalExam(exam);
    }
  };

  const photoSrc = profile?.photo
    ? (profile.photo.startsWith('http') ? profile.photo : `${BASE_URL}${profile.photo}`)
    : null;

  const initials = user?.name?.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-logo">
            <div className="navbar-logo-icon">📝</div>
            <span className="navbar-logo-text">ExamSite</span>
          </div>
          <div className="navbar-actions">
            <button
              id="messages-nav-btn"
              className="btn btn-outline btn-sm nav-chat-btn"
              onClick={() => navigate('/messages')}
              title="Open Messenger"
            >
              💬 Messages
              {unreadCount > 0 && (
                <span className="nav-unread-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            <button
              id="logout-btn"
              className="btn btn-outline btn-sm"
              onClick={() => { logout(); navigate('/login'); }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div className="profile-page">
        <div className="container">

          {/* Profile Header */}
          <div className="profile-header glass">
            {/* Avatar */}
            <div className="avatar-wrapper">
              {photoSrc ? (
                <img src={photoSrc} alt="Profile" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">{initials}</div>
              )}
              <label className="avatar-upload-btn" title="Upload photo">
                {uploading ? '⟳' : '📷'}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  id="photo-upload-input"
                />
              </label>
            </div>

            <div className="text-center">
              <div className="profile-name">{user?.name}</div>
              <div className="profile-email">{user?.email}</div>

              {/* Chat with Authority / Messenger Quick Action */}
              <div style={{ marginTop: '0.9rem', display: 'flex', gap: '0.65rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  id="chat-authority-btn"
                  className="btn btn-primary btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontWeight: 700
                  }}
                  onClick={() => navigate('/messages?to=admin')}
                >
                  👑 Chat with Authority
                </button>
                <button
                  id="profile-messenger-btn"
                  className="btn btn-outline btn-sm nav-chat-btn"
                  onClick={() => navigate('/messages')}
                >
                  💬 Messenger
                  {unreadCount > 0 && (
                    <span className="nav-unread-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{display:'flex', gap:'2rem', marginTop:'0.5rem'}}>
              <div className="text-center">
                <div style={{fontSize:'1.4rem', fontWeight:800, color:'var(--primary-light)'}}>{exams.length}</div>
                <div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Available</div>
              </div>
              <div className="text-center">
                <div style={{fontSize:'1.4rem', fontWeight:800, color:'var(--accent-green)'}}>{exams.filter(e=>e.alreadySubmitted).length}</div>
                <div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Completed</div>
              </div>
              <div className="text-center">
                <div style={{fontSize:'1.4rem', fontWeight:800, color:'var(--accent-amber)'}}>{exams.filter(e=>!e.alreadySubmitted).length}</div>
                <div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Pending</div>
              </div>
            </div>
          </div>

          {/* Exams Section */}
          <div className="exams-section">
            <h2 className="section-title">📚 Available Exams</h2>
            {loading ? (
              <div className="loader-wrap"><div className="spinner" /></div>
            ) : exams.length === 0 ? (
              <div className="glass" style={{padding:'3rem', textAlign:'center', color:'var(--text-muted)'}}>
                <div style={{fontSize:'3rem', marginBottom:'1rem'}}>📭</div>
                <p>No exams available yet. Check back soon!</p>
              </div>
            ) : (
              <div className="exams-grid">
                {exams.map((exam) => (
                  <div
                    key={exam._id}
                    id={`exam-card-${exam._id}`}
                    className={`exam-card${exam.alreadySubmitted ? ' submitted' : ''}`}
                    onClick={() => handleExamClick(exam)}
                  >
                    <div className="flex-between mb-1">
                      <div>
                        <div className="exam-card-title">{exam.title}</div>
                        <div className="exam-card-author">by {exam.author}</div>
                      </div>
                      {exam.alreadySubmitted && exam.userSubmission && (
                        <div style={{ textAlign: 'right' }}>
                          <span
                            className={`badge ${exam.userSubmission.passed ? 'badge-success' : 'badge-danger'}`}
                            title="Official score from your 1st exam attempt"
                          >
                            {exam.userSubmission.passed ? '✓ Passed' : '✗ Failed'} ({exam.userSubmission.score}/{exam.totalMarks})
                          </span>
                          {exam.userSubmission.retakeCount > 0 && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              🔄 {exam.userSubmission.retakeCount} practice retake{exam.userSubmission.retakeCount > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="exam-meta">
                      <span className="exam-meta-item">⏱ {exam.totalTime} min</span>
                      <span className="exam-meta-item">📊 {exam.totalMarks} marks</span>
                      <span className="exam-meta-item">✅ Pass: {exam.passMarks}</span>
                      <span className="exam-meta-item">❓ {exam.totalQuestions} MCQs</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button
                        id={`exam-action-btn-${exam._id}`}
                        className={`btn btn-sm btn-full ${exam.alreadySubmitted ? 'btn-outline' : 'btn-primary'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExamClick(exam);
                        }}
                        title={
                          exam.alreadySubmitted
                            ? 'Retake exam for practice (official evaluation remains from 1st attempt)'
                            : 'Start exam'
                        }
                      >
                        {exam.alreadySubmitted ? '↺ Practice Retake' : '→ Start Exam'}
                      </button>

                      <button
                        id={`exam-answers-btn-${exam._id}`}
                        className="btn btn-sm btn-full btn-outline"
                        style={{
                          background: exam.alreadySubmitted ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                          borderColor: exam.alreadySubmitted ? 'rgba(99,102,241,0.45)' : 'var(--border)',
                          color: exam.alreadySubmitted ? 'var(--primary-light)' : 'var(--text-secondary)',
                          fontWeight: 600,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewAnswers(exam);
                        }}
                        title={
                          exam.alreadySubmitted
                            ? 'View question PDF, your answers and solutions'
                            : 'First participate in exam to unlock solutions'
                        }
                      >
                        👁 See Answers
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Participation Required Note Modal */}
      {participationModalExam && (
        <div
          className="modal-overlay"
          onClick={() => setParticipationModalExam(null)}
        >
          <div
            className="note-modal-card glass-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔒</div>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              Participation Required
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.25rem' }}>
              You have not participated in <strong style={{ color: 'var(--primary-light)' }}>{participationModalExam.title}</strong> yet.
              Please participate in the exam first before viewing the question PDF, your submitted answers, and the correct answer key.
            </p>
            <div style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: 'var(--accent-amber)',
              borderRadius: 'var(--radius-md)',
              padding: '0.65rem 0.85rem',
              fontSize: '0.82rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: 'center',
              fontWeight: 500,
            }}>
              <span>⚠️</span>
              <span>First participate in the exam to view answers and solutions!</span>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                id="close-participation-modal-btn"
                className="btn btn-outline"
                onClick={() => setParticipationModalExam(null)}
              >
                Close
              </button>
              <button
                id="start-from-modal-btn"
                className="btn btn-primary"
                onClick={() => {
                  const examId = participationModalExam._id;
                  setParticipationModalExam(null);
                  navigate(`/exam/${examId}`);
                }}
              >
                → Start Exam Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
