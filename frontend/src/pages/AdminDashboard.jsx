import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import axios from 'axios';
import { API_BASE, API_ORIGIN } from '../utils/api';

const adminApi = axios.create({ baseURL: API_BASE });
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const BANGLA_OPTIONS = ['ক', 'খ', 'গ', 'ঘ'];

export default function AdminDashboard() {
  const [tab, setTab] = useState('create');
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({
    title: '',
    author: '',
    totalTime: 60,
    totalMarks: 100,
    passMarks: 40,
    marksPerMCQ: 1,
    negativeMark: 0,
    totalQuestions: '',
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [editingExam, setEditingExam] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    author: '',
    totalTime: 60,
    totalMarks: 100,
    passMarks: 40,
    marksPerMCQ: 1,
    negativeMark: 0,
    totalQuestions: '',
  });

  // Mail Broadcast States
  const [mailSubject, setMailSubject] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [mailAudience, setMailAudience] = useState('verified'); // 'verified' | 'all' | 'custom'
  const [mailCustomEmail, setMailCustomEmail] = useState('');
  const [mailAttachment, setMailAttachment] = useState(null);
  const [mailAttachmentPreview, setMailAttachmentPreview] = useState(null);
  const [mailStats, setMailStats] = useState({ totalUsers: 0, verifiedUsers: 0, loading: false });
  const [sendingMail, setSendingMail] = useState(false);
  const [mailDeliveryReport, setMailDeliveryReport] = useState(null);
  const [showMailConfirmModal, setShowMailConfirmModal] = useState(false);


  const handleOpenEdit = (exam) => {
    setEditingExam(exam);
    setEditForm({
      title: exam.title || '',
      author: exam.author || '',
      totalTime: exam.totalTime || 60,
      totalMarks: exam.totalMarks || 100,
      passMarks: exam.passMarks || 40,
      marksPerMCQ: exam.marksPerMCQ || 1,
      negativeMark: exam.negativeMark || 0,
      totalQuestions: exam.totalQuestions || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingExam) return;
    setSavingEdit(true);
    try {
      const res = await adminApi.put(`/admin/exam/${editingExam._id}`, editForm);
      setExams((prev) =>
        prev.map((ex) => (ex._id === editingExam._id ? { ...ex, ...res.data.exam } : ex))
      );
      toast.success('Exam updated successfully! 🎉');
      setEditingExam(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update exam');
    } finally {
      setSavingEdit(false);
    }
  };

  const [resultsModal, setResultsModal] = useState(null);

  const handleViewResults = async (exam) => {
    setResultsModal({
      examId: exam._id,
      examTitle: exam.title,
      totalMarks: exam.totalMarks,
      passMarks: exam.passMarks,
      loading: true,
      results: [],
    });

    try {
      const res = await adminApi.get(`/admin/exam/${exam._id}/participants`);
      // Sort strictly highest obtained marks to lowest
      const sorted = (res.data.participants || []).sort((a, b) => b.score - a.score);
      setResultsModal({
        examId: exam._id,
        examTitle: res.data.exam.title,
        totalMarks: res.data.exam.totalMarks,
        passMarks: res.data.exam.passMarks,
        results: sorted,
        loading: false,
      });
    } catch (err) {
      toast.error('Failed to load results');
      setResultsModal(null);
    }
  };

  const [downloadingMasterPdf, setDownloadingMasterPdf] = useState(false);

  const handleDownloadMasterPDF = async (examId, examTitle) => {
    setDownloadingMasterPdf(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${API_BASE}/admin/exam/${examId}/master-result-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to generate master results PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(examTitle || 'Exam').replace(/[^a-zA-Z0-9_-]/g, '_')}_All_Results.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('All Results Master PDF downloaded! 📄');
    } catch (err) {
      toast.error('Failed to download master result PDF');
    } finally {
      setDownloadingMasterPdf(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const fetchExams = async () => {
    setLoadingExams(true);
    try {
      const res = await adminApi.get('/admin/exams');
      setExams(res.data.exams);
    } catch { toast.error('Failed to load exams'); }
    finally { setLoadingExams(false); }
  };

  const fetchMailStats = async () => {
    setMailStats((prev) => ({ ...prev, loading: true }));
    try {
      const res = await adminApi.get('/admin/mail/stats');
      setMailStats({
        totalUsers: res.data.totalUsers || 0,
        verifiedUsers: res.data.verifiedUsers || 0,
        loading: false,
      });
    } catch (err) {
      console.error('Failed to fetch mail stats:', err);
      setMailStats((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (tab === 'exams') fetchExams();
    if (tab === 'mail') fetchMailStats();
  }, [tab]);

  const handleMailAttachmentChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ];

    if (!validTypes.includes(file.type)) {
      toast.error('Only PDF documents or image files (JPG, PNG, WebP, GIF) are allowed');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Attachment file size must be less than 25MB');
      return;
    }

    setMailAttachment(file);
    if (file.type.startsWith('image/')) {
      setMailAttachmentPreview(URL.createObjectURL(file));
    } else {
      setMailAttachmentPreview(null);
    }
  };

  const handleRemoveAttachment = () => {
    if (mailAttachmentPreview) {
      URL.revokeObjectURL(mailAttachmentPreview);
    }
    setMailAttachment(null);
    setMailAttachmentPreview(null);
  };

  const targetRecipientCount =
    mailAudience === 'custom'
      ? 1
      : mailAudience === 'all'
      ? mailStats.totalUsers
      : mailStats.verifiedUsers;

  const handleInitiateSendMail = (e) => {
    e.preventDefault();
    if (!mailSubject.trim()) {
      return toast.error('Please enter an email subject');
    }
    if (!mailMessage.trim()) {
      return toast.error('Please enter the message body');
    }
    if (mailAudience === 'custom') {
      if (!mailCustomEmail.trim() || !mailCustomEmail.includes('@')) {
        return toast.error('Please enter a valid recipient email address');
      }
    } else if (targetRecipientCount === 0) {
      return toast.error('There are no recipients found in the selected audience');
    }

    setShowMailConfirmModal(true);
  };

  const handleConfirmSendMail = async () => {
    setShowMailConfirmModal(false);
    setSendingMail(true);
    setMailDeliveryReport(null);

    try {
      const formData = new FormData();
      formData.append('subject', mailSubject.trim());
      formData.append('message', mailMessage.trim());
      formData.append('audience', mailAudience);
      if (mailAudience === 'custom') {
        formData.append('customEmail', mailCustomEmail.trim());
      }
      if (mailAttachment) {
        formData.append('attachment', mailAttachment);
      }

      // Do not manually override Content-Type header so Axios & browser can attach boundary parameter
      const res = await adminApi.post('/admin/mail/send', formData);

      if (res.data.sentCount === 0 && res.data.failCount > 0) {
        const errorDetail = res.data.errors?.[0]?.error || 'Failed to send emails';
        toast.error(`Sending failed: ${errorDetail}`);
      } else if (res.data.failCount > 0) {
        toast.warning(`Sent to ${res.data.sentCount} users, but failed for ${res.data.failCount} users.`);
      } else {
        toast.success(res.data.message || 'Email broadcast sent successfully! 🎉');
      }

      setMailDeliveryReport({
        total: res.data.total,
        sentCount: res.data.sentCount,
        failCount: res.data.failCount,
        timestamp: new Date().toLocaleTimeString(),
        errors: res.data.errors || [],
      });

      setMailSubject('');
      setMailMessage('');
      handleRemoveAttachment();
    } catch (err) {
      console.error('Mail broadcast error:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to send broadcast email';
      toast.error(errMsg);
    } finally {
      setSendingMail(false);
    }
  };


  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleCreateExam = async (e) => {
    e.preventDefault();
    if (!pdfFile) return toast.error('Please upload the question PDF');
    if (!csvFile) return toast.error('Please upload the answer CSV');

    setCreating(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      formData.append('questionPdf', pdfFile);
      formData.append('answerCsv', csvFile);

      await adminApi.post('/admin/exam', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Exam created successfully! 🎉');
      setForm({ title:'', author:'', totalTime:60, totalMarks:100, passMarks:40, marksPerMCQ:1, negativeMark:0, totalQuestions:'' });
      setPdfFile(null);
      setCsvFile(null);
      setTab('exams');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create exam');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (examId, currentStatus) => {
    try {
      await adminApi.put(`/admin/exam/${examId}/toggle`);
      setExams((prev) => prev.map((e) => e._id === examId ? {...e, isActive: !e.isActive} : e));
      toast.success(`Exam ${currentStatus ? 'deactivated' : 'activated'}`);
    } catch { toast.error('Failed to toggle exam'); }
  };

  const handleDelete = async (examId) => {
    if (!confirm('Are you sure you want to delete this exam? This cannot be undone.')) return;
    try {
      await adminApi.delete(`/admin/exam/${examId}`);
      setExams((prev) => prev.filter((e) => e._id !== examId));
      toast.success('Exam deleted');
    } catch { toast.error('Failed to delete exam'); }
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-logo">
            <div className="navbar-logo-icon" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>🛡️</div>
            <span className="navbar-logo-text" style={{background:'linear-gradient(135deg,#fbbf24,#f59e0b)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>
              Admin Panel
            </span>
          </div>
          <button id="admin-logout-btn" className="btn btn-outline btn-sm" onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <div className="admin-page">
        <div className="container">
          <div className="admin-tabs">
            <div
              id="tab-create"
              className={`admin-tab${tab === 'create' ? ' active' : ''}`}
              onClick={() => setTab('create')}
            >+ Create Exam</div>
            <div
              id="tab-exams"
              className={`admin-tab${tab === 'exams' ? ' active' : ''}`}
              onClick={() => setTab('exams')}
            >📋 Manage Exams</div>
            <div
              id="tab-mail"
              className={`admin-tab${tab === 'mail' ? ' active' : ''}`}
              onClick={() => setTab('mail')}
            >✉️ Broadcast Mail</div>
          </div>

          {/* ── Create Exam Tab ── */}
          {tab === 'create' && (
            <div className="glass" style={{padding:'2rem', maxWidth:700}}>
              <h2 style={{marginBottom:'1.5rem'}}>Create New Exam</h2>
              <form id="create-exam-form" onSubmit={handleCreateExam}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                  <div className="form-group" style={{gridColumn:'1/-1'}}>
                    <label className="form-label">Exam Title *</label>
                    <input name="title" className="form-input" placeholder="e.g. BCS Preliminary 2026" value={form.title} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}>
                    <label className="form-label">Author *</label>
                    <input name="author" className="form-input" placeholder="Author or Institution name" value={form.author} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Time (minutes) *</label>
                    <input name="totalTime" type="number" min="1" className="form-input" value={form.totalTime} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Marks *</label>
                    <input name="totalMarks" type="number" min="1" className="form-input" value={form.totalMarks} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pass Marks *</label>
                    <input name="passMarks" type="number" min="0" className="form-input" value={form.passMarks} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Marks per MCQ (default: 1)</label>
                    <input name="marksPerMCQ" type="number" min="0.25" step="0.25" className="form-input" value={form.marksPerMCQ} onChange={handleFormChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Questions / MCQs (e.g. 10, 50)</label>
                    <input
                      name="totalQuestions"
                      type="number"
                      min="1"
                      className="form-input"
                      placeholder="e.g. 10, 50 (auto if empty)"
                      value={form.totalQuestions}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group" style={{gridColumn:'1/-1'}}>
                    <label className="form-label">Negative Mark per Wrong Answer (0 = no negative)</label>
                    <input name="negativeMark" type="number" min="0" step="0.25" className="form-input" value={form.negativeMark} onChange={handleFormChange} />
                  </div>
                </div>

                {/* PDF Upload */}
                <div className="form-group">
                  <label className="form-label">Question PDF *</label>
                  <div className="file-input-wrapper">
                    <span className="file-input-icon">📄</span>
                    <p style={{color:'var(--text-secondary)', marginBottom:'0.25rem'}}>
                      {pdfFile ? <strong style={{color:'var(--primary-light)'}}>{pdfFile.name}</strong> : 'Click to upload Question PDF'}
                    </p>
                    <p style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>PDF format only • Max 50MB</p>
                    <input
                      id="pdf-upload"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setPdfFile(e.target.files[0])}
                    />
                  </div>
                </div>

                {/* CSV Upload */}
                <div className="form-group">
                  <label className="form-label">Answer Key CSV *</label>
                  <div className="file-input-wrapper">
                    <span className="file-input-icon">📊</span>
                    <p style={{color:'var(--text-secondary)', marginBottom:'0.25rem'}}>
                      {csvFile ? <strong style={{color:'var(--primary-light)'}}>{csvFile.name}</strong> : 'Click to upload Answer CSV'}
                    </p>
                    <p style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>
                      CSV with columns: প্রশ্ন নম্বর, উত্তর (Bangla numerals &amp; ক/খ/গ/ঘ)
                    </p>
                    <input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files[0])}
                    />
                  </div>
                  <div style={{
                    marginTop:'0.75rem', padding:'1rem',
                    background:'rgba(99,102,241,0.08)', borderRadius:'var(--radius-md)',
                    border:'1px solid var(--border)', fontSize:'0.8rem', color:'var(--text-secondary)'
                  }}>
                    <strong style={{color:'var(--primary-light)'}}>CSV Format Example:</strong>
                    <pre style={{marginTop:'0.5rem', fontFamily:'monospace', fontSize:'0.8rem', color:'var(--text-muted)'}}>
{`প্রশ্ন নম্বর,উত্তর
১,ক
২,খ
৩,গ
৪,ঘ`}
                    </pre>
                  </div>
                </div>

                <button
                  id="create-exam-btn"
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={creating}
                >
                  {creating
                    ? <><span className="spinner" style={{width:18,height:18,borderWidth:2}} /> Creating Exam…</>
                    : '+ Create Exam'}
                </button>
              </form>
            </div>
          )}

          {/* ── Manage Exams Tab ── */}
          {tab === 'exams' && (
            <div>
              <div className="flex-between mb-3">
                <h2>All Exams ({exams.length})</h2>
                <button className="btn btn-primary btn-sm" onClick={fetchExams}>↺ Refresh</button>
              </div>
              {loadingExams ? (
                <div className="loader-wrap"><div className="spinner" /></div>
              ) : exams.length === 0 ? (
                <div className="glass" style={{padding:'3rem', textAlign:'center', color:'var(--text-muted)'}}>
                  <div style={{fontSize:'3rem', marginBottom:'1rem'}}>📭</div>
                  <p>No exams yet. Create one!</p>
                </div>
              ) : (
                <div style={{display:'flex', flexDirection:'column', gap:'1rem'}}>
                  {exams.map((exam) => (
                    <div key={exam._id} id={`admin-exam-${exam._id}`} className="glass" style={{padding:'1.5rem'}}>
                      <div className="flex-between">
                        <div>
                          <div style={{display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.25rem'}}>
                            <h3 style={{fontSize:'1.05rem'}}>{exam.title}</h3>
                            <span className={`badge ${exam.isActive ? 'badge-success' : 'badge-danger'}`}>
                              {exam.isActive ? '● Active' : '○ Inactive'}
                            </span>
                          </div>
                          <p style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>by {exam.author}</p>
                          <div className="exam-meta" style={{marginTop:'0.75rem'}}>
                            <span className="exam-meta-item">⏱ {exam.totalTime} min</span>
                            <span className="exam-meta-item">📊 {exam.totalMarks} marks</span>
                            <span className="exam-meta-item">✅ Pass: {exam.passMarks}</span>
                            <span className="exam-meta-item">❓ {exam.totalQuestions} MCQs</span>
                            <span className="exam-meta-item">⭐ {exam.marksPerMCQ}/MCQ</span>
                          </div>
                          <p style={{fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'0.25rem'}}>
                            Created: {new Date(exam.createdAt).toLocaleDateString('en-GB')}
                          </p>
                        </div>
                        <div style={{display:'flex', flexDirection:'column', gap:'0.5rem', alignItems:'flex-end'}}>
                          <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap', justifyContent:'flex-end'}}>
                            <button
                              className="btn btn-sm"
                              style={{
                                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.15))',
                                border: '1px solid rgba(245, 158, 11, 0.6)',
                                color: '#fde68a',
                                fontWeight: 700
                              }}
                              onClick={() => handleViewResults(exam)}
                            >
                              🏆 See All Results
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ borderColor: 'var(--primary-light)', color: 'var(--primary-light)' }}
                              onClick={() => handleOpenEdit(exam)}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className={`btn btn-sm ${exam.isActive ? 'btn-outline' : 'btn-success'}`}
                              onClick={() => handleToggle(exam._id, exam.isActive)}
                            >
                              {exam.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(exam._id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Broadcast Mail Tab ── */}
          {tab === 'mail' && (
            <div className="glass" style={{ padding: '2rem', maxWidth: 760, margin: '0 auto' }}>
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ margin: '0 0 0.4rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      ✉️ Broadcast Email Announcement
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
                      Send notices, guidelines, PDFs, or images directly to candidate inboxes.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={fetchMailStats}
                    disabled={mailStats.loading}
                    title="Refresh recipient numbers"
                  >
                    🔄 Refresh Recipient Counts
                  </button>
                </div>
              </div>

              {/* Recipient Stats Bar */}
              <div className="mail-stats-bar">
                <div className="mail-stat-badge">
                  <span>👥 Verified Students:</span>
                  <strong>{mailStats.loading ? '...' : mailStats.verifiedUsers}</strong>
                </div>
                <div className="mail-stat-badge">
                  <span>🌐 Total Registered Users:</span>
                  <strong>{mailStats.loading ? '...' : mailStats.totalUsers}</strong>
                </div>
              </div>

              {/* Form */}
              <form id="mail-broadcast-form" onSubmit={handleInitiateSendMail}>
                {/* Target Audience Selector */}
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ marginBottom: '0.6rem' }}>
                    🎯 Select Target Audience *
                  </label>
                  <div className="mail-audience-grid">
                    <div
                      className={`mail-audience-card${mailAudience === 'verified' ? ' selected' : ''}`}
                      onClick={() => setMailAudience('verified')}
                    >
                      <div className="mail-audience-title">
                        <span>✅ Verified Students</span>
                        {mailAudience === 'verified' && <span style={{ color: 'var(--primary-light)', marginLeft: 'auto' }}>●</span>}
                      </div>
                      <div className="mail-audience-desc">
                        Sends to {mailStats.verifiedUsers} users with verified emails (Recommended).
                      </div>
                    </div>

                    <div
                      className={`mail-audience-card${mailAudience === 'all' ? ' selected' : ''}`}
                      onClick={() => setMailAudience('all')}
                    >
                      <div className="mail-audience-title">
                        <span>🌐 All Registered</span>
                        {mailAudience === 'all' && <span style={{ color: 'var(--primary-light)', marginLeft: 'auto' }}>●</span>}
                      </div>
                      <div className="mail-audience-desc">
                        Sends to all {mailStats.totalUsers} registered users in the database.
                      </div>
                    </div>

                    <div
                      className={`mail-audience-card${mailAudience === 'custom' ? ' selected' : ''}`}
                      onClick={() => setMailAudience('custom')}
                    >
                      <div className="mail-audience-title">
                        <span>🧪 Test / Specific</span>
                        {mailAudience === 'custom' && <span style={{ color: 'var(--primary-light)', marginLeft: 'auto' }}>●</span>}
                      </div>
                      <div className="mail-audience-desc">
                        Send a preview test mail to a single email address.
                      </div>
                    </div>
                  </div>

                  {mailAudience === 'custom' && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <label className="form-label" style={{ fontSize: '0.82rem' }}>Custom Recipient Email *</label>
                      <input
                        id="mail-custom-email"
                        type="email"
                        className="form-input"
                        placeholder="e.g. admin@example.com or your test email"
                        value={mailCustomEmail}
                        onChange={(e) => setMailCustomEmail(e.target.value)}
                        required={mailAudience === 'custom'}
                      />
                    </div>
                  )}
                </div>

                {/* Subject */}
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">
                    🏷️ Email Subject *
                  </label>
                  <input
                    id="mail-subject"
                    name="mailSubject"
                    className="form-input"
                    placeholder="e.g. 📢 Important Notice: Upcoming Exam Schedule & Instructions"
                    value={mailSubject}
                    onChange={(e) => setMailSubject(e.target.value)}
                    required
                  />
                </div>

                {/* Message Body (Text Box) */}
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                    <label className="form-label" style={{ margin: 0 }}>
                      📝 Message Body (Text Box) *
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {mailMessage.length} characters
                    </span>
                  </div>
                  <textarea
                    id="mail-message"
                    name="mailMessage"
                    className="form-input form-textarea"
                    rows={8}
                    placeholder="Type your message or announcement text here...&#10;&#10;Line breaks and paragraphs will be formatted cleanly in the email."
                    value={mailMessage}
                    onChange={(e) => setMailMessage(e.target.value)}
                    required
                    style={{ lineHeight: 1.6 }}
                  />
                </div>

                {/* File Attachment: PDF or Image */}
                <div className="form-group" style={{ marginBottom: '1.75rem' }}>
                  <label className="form-label">
                    📎 Attach PDF or Image (Optional)
                  </label>

                  {!mailAttachment ? (
                    <div className="file-input-wrapper">
                      <span className="file-input-icon">📎</span>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        Click or drag to attach a <strong style={{ color: 'var(--primary-light)' }}>PDF</strong> or <strong style={{ color: 'var(--primary-light)' }}>Image</strong>
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Supported formats: PDF, JPG, PNG, WebP, GIF • Max 25MB
                      </p>
                      <input
                        id="mail-file-upload"
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleMailAttachmentChange}
                      />
                    </div>
                  ) : (
                    <div className="mail-attachment-preview">
                      {mailAttachmentPreview ? (
                        <img
                          src={mailAttachmentPreview}
                          alt="Attachment preview"
                          className="mail-attachment-thumb"
                        />
                      ) : (
                        <div className="mail-attachment-icon">📄</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {mailAttachment.name}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {(mailAttachment.size / (1024 * 1024)).toFixed(2)} MB • {mailAttachment.type || 'File'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={handleRemoveAttachment}
                        style={{ color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  )}
                </div>

                {/* Submit Actions */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    id="mail-send-btn"
                    type="submit"
                    className="btn btn-primary"
                    disabled={sendingMail || !mailSubject.trim() || !mailMessage.trim() || (mailAudience !== 'custom' && targetRecipientCount === 0)}
                    style={{ flex: 1, padding: '0.85rem 1.5rem', fontSize: '0.95rem' }}
                  >
                    {sendingMail ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <span className="spinner" style={{ width: 18, height: 18 }}></span>
                        Sending to {targetRecipientCount} {targetRecipientCount === 1 ? 'User' : 'Users'}...
                      </span>
                    ) : (
                      `🚀 Send to ${mailAudience === 'custom' ? 'Test Recipient' : `All (${targetRecipientCount} Users)`}`
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setMailSubject('');
                      setMailMessage('');
                      handleRemoveAttachment();
                    }}
                    disabled={sendingMail || (!mailSubject && !mailMessage && !mailAttachment)}
                  >
                    Clear
                  </button>
                </div>
              </form>

              {/* Delivery Report Card */}
              {mailDeliveryReport && (
                <div className="mail-delivery-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>✅</span>
                    <strong style={{ color: 'var(--accent-green)', fontSize: '0.98rem' }}>
                      Broadcast Complete at {mailDeliveryReport.timestamp}
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <span>Total Targeted: <strong>{mailDeliveryReport.total}</strong></span>
                    <span>Delivered Successfully: <strong style={{ color: 'var(--accent-green)' }}>{mailDeliveryReport.sentCount}</strong></span>
                    {mailDeliveryReport.failCount > 0 && (
                      <span>Failed: <strong style={{ color: 'var(--accent-red)' }}>{mailDeliveryReport.failCount}</strong></span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Exam Modal ── */}
      {editingExam && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(6px)', padding: '1rem'
        }}>
          <div className="glass-elevated" style={{
            padding: '2rem', maxWidth: 650, width: '100%',
            maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)'
          }}>
            <div className="flex-between mb-2">
              <h3 style={{ margin: 0, color: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ✏️ Edit Exam: {editingExam.title}
              </h3>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setEditingExam(null)}
                style={{ padding: '4px 10px' }}
              >
                ✕ Close
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Update exam timing, marks, title or author details below.
            </p>

            <form onSubmit={handleSaveEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Exam Title *</label>
                  <input
                    name="title"
                    className="form-input"
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Author *</label>
                  <input
                    name="author"
                    className="form-input"
                    value={editForm.author}
                    onChange={(e) => setEditForm((f) => ({ ...f, author: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Total Time (minutes) *</label>
                  <input
                    name="totalTime"
                    type="number"
                    min="1"
                    className="form-input"
                    value={editForm.totalTime}
                    onChange={(e) => setEditForm((f) => ({ ...f, totalTime: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Total Marks *</label>
                  <input
                    name="totalMarks"
                    type="number"
                    min="1"
                    className="form-input"
                    value={editForm.totalMarks}
                    onChange={(e) => setEditForm((f) => ({ ...f, totalMarks: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Pass Marks *</label>
                  <input
                    name="passMarks"
                    type="number"
                    min="0"
                    className="form-input"
                    value={editForm.passMarks}
                    onChange={(e) => setEditForm((f) => ({ ...f, passMarks: e.target.value }))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Marks per MCQ</label>
                  <input
                    name="marksPerMCQ"
                    type="number"
                    min="0.25"
                    step="0.25"
                    className="form-input"
                    value={editForm.marksPerMCQ}
                    onChange={(e) => setEditForm((f) => ({ ...f, marksPerMCQ: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Total Questions / MCQs (e.g. 10, 50)</label>
                  <input
                    name="totalQuestions"
                    type="number"
                    min="1"
                    className="form-input"
                    placeholder="e.g. 10, 50"
                    value={editForm.totalQuestions}
                    onChange={(e) => setEditForm((f) => ({ ...f, totalQuestions: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Negative Mark per Wrong Answer</label>
                  <input
                    name="negativeMark"
                    type="number"
                    min="0"
                    step="0.25"
                    className="form-input"
                    value={editForm.negativeMark}
                    onChange={(e) => setEditForm((f) => ({ ...f, negativeMark: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingExam(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Saving…' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ── All Results Leaderboard Modal (Highest to Lowest) ── */}
      {resultsModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(8px)', padding: '1rem'
        }}>
          <div className="glass-elevated" style={{
            padding: '2rem', maxWidth: 850, width: '100%',
            maxHeight: '90vh', overflowY: 'auto', borderRadius: 'var(--radius-lg)'
          }}>
            {/* Header */}
            <div className="flex-between mb-3">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.6rem' }}>🏆</span>
                  <h3 style={{
                    margin: 0, fontSize: '1.3rem',
                    background: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                  }}>
                    Exam Results & Rankings
                  </h3>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '6px 0 0' }}>
                  <strong>{resultsModal.examTitle}</strong> • Total Marks: <strong>{resultsModal.totalMarks}</strong> • Pass Marks: <strong style={{ color: 'var(--accent-green)' }}>{resultsModal.passMarks}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  className="btn btn-sm"
                  disabled={downloadingMasterPdf || resultsModal.results.length === 0}
                  onClick={() => handleDownloadMasterPDF(resultsModal.examId, resultsModal.examTitle)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: downloadingMasterPdf ? 'wait' : 'pointer',
                    boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  {downloadingMasterPdf ? '⏳ Generating PDF…' : '⬇️ Download All Results PDF'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setResultsModal(null)}
                  style={{ padding: '6px 12px' }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {resultsModal.loading ? (
              <div className="loader-wrap" style={{ padding: '3rem 0' }}><div className="spinner" /></div>
            ) : resultsModal.results.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📭</div>
                <h4>No submissions recorded yet</h4>
                <p style={{ fontSize: '0.85rem' }}>Results will appear here sorted from highest to lowest marks once students take the exam.</p>
              </div>
            ) : (
              <div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '1rem', padding: '0.6rem 0.85rem',
                  background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                  fontSize: '0.8rem', color: 'var(--text-muted)'
                }}>
                  <span>Showing <strong>{resultsModal.results.length}</strong> candidate(s) • Sorted by Highest Obtained Marks ⬇️</span>
                  <span>Top Score: <strong style={{ color: 'var(--accent-green)', fontSize: '0.95rem' }}>{resultsModal.results[0]?.score} / {resultsModal.totalMarks}</strong></span>
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{
                        background: 'rgba(255,255,255,0.06)',
                        borderBottom: '2px solid rgba(255,255,255,0.1)',
                        color: 'var(--text-secondary)'
                      }}>
                        <th style={{ padding: '10px 14px', width: '70px' }}>Rank</th>
                        <th style={{ padding: '10px 14px' }}>Candidate Name</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Total Marks</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Obtained Marks</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultsModal.results.map((r, idx) => {
                        const isTop1 = idx === 0;
                        const isTop2 = idx === 1;
                        const isTop3 = idx === 2;
                        const rankLabel = isTop1 ? '🥇 #1' : isTop2 ? '🥈 #2' : isTop3 ? '🥉 #3' : `#${idx + 1}`;
                        const initials = (r.user?.name || 'S').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
                        const photoSrc = r.user?.photo
                          ? (r.user.photo.startsWith('http') ? r.user.photo : `${API_ORIGIN || 'http://localhost:5000'}${r.user.photo}`)
                          : null;

                        return (
                          <tr
                            key={r.submissionId || idx}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              background: isTop1
                                ? 'rgba(245, 158, 11, 0.08)'
                                : idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                              transition: 'background 0.2s'
                            }}
                          >
                            {/* Rank */}
                            <td style={{ padding: '12px 14px', fontWeight: 800, color: isTop1 ? '#fbbf24' : isTop2 ? '#e2e8f0' : isTop3 ? '#cd7f32' : 'var(--text-muted)' }}>
                              {rankLabel}
                            </td>

                            {/* Candidate Name & Photo */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                  width: 34, height: 34, borderRadius: '50%', overflow: 'hidden',
                                  background: 'var(--primary)', display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: '#fff',
                                  flexShrink: 0
                                }}>
                                  {photoSrc ? (
                                    <img src={photoSrc} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    initials
                                  )}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, color: '#fff' }}>
                                    {r.user?.name || 'Unknown'}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {r.user?.email}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Total Marks */}
                            <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              {resultsModal.totalMarks}
                            </td>

                            {/* Obtained Marks */}
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '1.25rem', fontWeight: 800,
                                color: r.passed ? 'var(--accent-green)' : 'var(--accent-red)'
                              }}>
                                {r.score}
                              </span>
                            </td>

                            {/* Status */}
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <span className={`badge ${r.passed ? 'badge-success' : 'badge-danger'}`}>
                                {r.passed ? 'PASSED' : 'FAILED'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
              <button
                className="btn btn-outline"
                onClick={() => setResultsModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mail Send Confirmation Modal ── */}
      {showMailConfirmModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(6px)', padding: '1rem'
        }}>
          <div className="glass-elevated" style={{
            padding: '2rem', maxWidth: 520, width: '100%', borderRadius: 'var(--radius-lg)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}>📨</div>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>
                Confirm Broadcast Email
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                Please review your announcement details before dispatching.
              </p>
            </div>

            <div style={{
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              fontSize: '0.88rem'
            }}>
              <div style={{ marginBottom: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Target Audience: </span>
                <strong style={{ color: 'var(--primary-light)' }}>
                  {mailAudience === 'custom'
                    ? `Custom: ${mailCustomEmail}`
                    : mailAudience === 'all'
                    ? `All Registered (${mailStats.totalUsers} users)`
                    : `Verified Students (${mailStats.verifiedUsers} users)`}
                </strong>
              </div>

              <div style={{ marginBottom: '0.6rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subject: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{mailSubject}</strong>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)' }}>Attachment: </span>
                <strong style={{ color: mailAttachment ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                  {mailAttachment ? `📎 ${mailAttachment.name} (${(mailAttachment.size / (1024 * 1024)).toFixed(2)} MB)` : 'None'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowMailConfirmModal(false)}
              >
                Cancel
              </button>
              <button
                id="confirm-send-mail-btn"
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmSendMail}
              >
                🚀 Confirm &amp; Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

