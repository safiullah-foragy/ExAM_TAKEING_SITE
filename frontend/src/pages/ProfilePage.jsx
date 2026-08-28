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
    fetchProfile();
    fetchExams();
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
                        <span className={`badge ${exam.userSubmission.passed ? 'badge-success' : 'badge-danger'}`}>
                          {exam.userSubmission.passed ? '✓ Passed' : '✗ Failed'} ({exam.userSubmission.score}/{exam.totalMarks})
                        </span>
                      )}
                    </div>

                    <div className="exam-meta">
                      <span className="exam-meta-item">⏱ {exam.totalTime} min</span>
                      <span className="exam-meta-item">📊 {exam.totalMarks} marks</span>
                      <span className="exam-meta-item">✅ Pass: {exam.passMarks}</span>
                      <span className="exam-meta-item">❓ {exam.totalQuestions} MCQs</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        className={`btn btn-sm btn-full ${exam.alreadySubmitted ? 'btn-outline' : 'btn-primary'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExamClick(exam);
                        }}
                      >
                        {exam.alreadySubmitted ? '↺ Retake Exam' : '→ Start Exam'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
