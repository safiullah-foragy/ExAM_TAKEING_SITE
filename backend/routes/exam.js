const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const { protect } = require('../middleware/auth');
const { generateResultPDF } = require('../utils/pdfGenerator');
const { sendResultEmail, sendAdminResultNotificationEmail } = require('../utils/mailer');
const { deleteFromSupabase } = require('../utils/supabaseStorage');
const { existsInGridFS, getGridFSDownloadStream } = require('../utils/gridfsStorage');

// ─── GET /api/exam ────────────────────────────────────────────────────────────
// List active exams with user submission details (no answer key exposed)
router.get('/', protect, async (req, res) => {
  try {
    const exams = await Exam.find({ isActive: true })
      .select('-answerKey -negativeMark')
      .sort({ createdAt: -1 });

    // Fetch user's submissions
    const userSubmissions = await Submission.find({ userId: req.user._id });
    const submissionMap = {};
    userSubmissions.forEach((sub) => {
      const score = sub.firstScore !== undefined ? sub.firstScore : sub.score;
      const passed = sub.firstPassed !== undefined ? sub.firstPassed : sub.passed;
      const correct = sub.firstCorrect !== undefined ? sub.firstCorrect : sub.correct;
      const wrong = sub.firstWrong !== undefined ? sub.firstWrong : sub.wrong;
      const skipped = sub.firstSkipped !== undefined ? sub.firstSkipped : sub.skipped;
      const submittedAt = sub.firstSubmittedAt || sub.submittedAt;

      submissionMap[sub.examId.toString()] = {
        score,
        passed,
        correct,
        wrong,
        skipped,
        submittedAt,
        retakeCount: sub.retakeCount || 0,
        lastPracticeScore: sub.lastPracticeScore,
      };
    });

    const examsWithStatus = exams.map((exam) => ({
      ...exam.toObject(),
      alreadySubmitted: !!submissionMap[exam._id.toString()],
      userSubmission: submissionMap[exam._id.toString()] || null,
    }));

    res.json({ exams: examsWithStatus });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /api/exam/:id ────────────────────────────────────────────────────────
// Get exam details + PDF URL (no answer key)
router.get('/:id', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).select('-answerKey');
    if (!exam || (!exam.isActive && !req.admin)) {
      return res.status(404).json({ message: 'Exam not found or not active' });
    }

    // Check if already submitted
    const submission = await Submission.findOne({
      userId: req.user._id,
      examId: exam._id,
    });

    // Build PDF URL (Direct Supabase Cloud URL or streaming endpoint)
    let pdfUrl = exam.pdfPath;
    if (!pdfUrl || !pdfUrl.startsWith('http')) {
      pdfUrl = `/api/exam/${exam._id}/pdf`;
    }

    res.json({
      exam: {
        ...exam.toObject(),
        pdfUrl,
      },
      alreadySubmitted: !!submission,
      submission: submission
        ? {
            score: submission.score,
            passed: submission.passed,
            correct: submission.correct,
            wrong: submission.wrong,
            skipped: submission.skipped,
            submittedAt: submission.submittedAt,
          }
        : null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /api/exam/:id/review ─────────────────────────────────────────────────
// Get question PDF URL, user's given answers, and correct answers
router.get('/:id/review', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam || (!exam.isActive && !req.admin)) {
      return res.status(404).json({ message: 'Exam not found or not active' });
    }

    // Check if user has participated in this exam
    const submission = await Submission.findOne({
      userId: req.user._id,
      examId: exam._id,
    });

    if (!submission) {
      return res.status(403).json({
        message: 'Please participate in the exam first to view answers and solutions.',
      });
    }

    // Build PDF URL (Direct Supabase Cloud URL or streaming endpoint)
    let pdfUrl = exam.pdfPath;
    if (!pdfUrl || !pdfUrl.startsWith('http')) {
      pdfUrl = `/api/exam/${exam._id}/pdf`;
    }

    // Main evaluation is ALWAYS the 1st exam attempt
    const firstAnswers = (submission.firstAnswers && submission.firstAnswers.length > 0)
      ? submission.firstAnswers
      : submission.answers;
    const firstScore = submission.firstScore !== undefined ? submission.firstScore : submission.score;
    const firstCorrect = submission.firstCorrect !== undefined ? submission.firstCorrect : submission.correct;
    const firstWrong = submission.firstWrong !== undefined ? submission.firstWrong : submission.wrong;
    const firstSkipped = submission.firstSkipped !== undefined ? submission.firstSkipped : submission.skipped;
    const firstPassed = submission.firstPassed !== undefined ? submission.firstPassed : submission.passed;
    const firstSubmittedAt = submission.firstSubmittedAt || submission.submittedAt;
    const firstTimeTaken = submission.firstTimeTaken !== undefined ? submission.firstTimeTaken : submission.timeTaken;

    res.json({
      exam: {
        _id: exam._id,
        title: exam.title,
        author: exam.author,
        totalTime: exam.totalTime,
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        marksPerMCQ: exam.marksPerMCQ,
        negativeMark: exam.negativeMark,
        totalQuestions: exam.totalQuestions,
        pdfUrl,
        answerKey: exam.answerKey,
      },
      submission: {
        _id: submission._id,
        score: firstScore,
        totalAttempted: firstCorrect + firstWrong,
        correct: firstCorrect,
        wrong: firstWrong,
        skipped: firstSkipped,
        passed: firstPassed,
        timeTaken: firstTimeTaken,
        submittedAt: firstSubmittedAt,
        answers: firstAnswers,
        resultPdfPath: submission.resultPdfPath,
        retakeCount: submission.retakeCount || 0,
        lastPracticeScore: submission.lastPracticeScore,
        isFirstAttemptRecord: true,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /api/exam/:id/pdf ────────────────────────────────────────────────────
// Stream question PDF directly from GridFS, local disk, or redirect to cloud URL
router.get('/:id/pdf', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam || (!exam.isActive && !req.admin)) {
      return res.status(404).json({ message: 'Exam not found or not active' });
    }

    // 1. Check if stored in MongoDB GridFS (100% persistent across server restarts)
    if (exam.pdfGridFSId) {
      const exists = await existsInGridFS(exam.pdfGridFSId);
      if (exists) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(exam.pdfOriginalName || 'question.pdf')}"`);
        return getGridFSDownloadStream(exam.pdfGridFSId).pipe(res);
      }
    }

    // 2. Direct remote Cloud storage URL
    if (exam.pdfPath && (exam.pdfPath.startsWith('http://') || exam.pdfPath.startsWith('https://'))) {
      return res.redirect(exam.pdfPath);
    }

    // 3. Local disk storage fallback
    if (exam.pdfPath) {
      let localPath = exam.pdfPath;
      if (!path.isAbsolute(localPath)) {
        localPath = path.join(__dirname, '..', localPath.replace(/^\//, ''));
      }

      if (fs.existsSync(localPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(exam.pdfOriginalName || 'question.pdf')}"`);
        return fs.createReadStream(localPath).pipe(res);
      }

      const filename = path.basename(exam.pdfPath);
      const altPath = path.join(__dirname, '../uploads/pdfs', filename);
      if (fs.existsSync(altPath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(exam.pdfOriginalName || 'question.pdf')}"`);
        return fs.createReadStream(altPath).pipe(res);
      }
    }

    return res.status(404).json({
      message: 'Question PDF file could not be found on the server. Please edit the exam in the Admin dashboard to re-upload the PDF.',
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch exam PDF', error: error.message });
  }
});

// ─── POST /api/exam/:id/submit ────────────────────────────────────────────────
// Submit or re-take exam (updates existing score and sends updated result PDF)
router.post('/:id/submit', protect, async (req, res) => {
  try {
    const { answers, timeTaken } = req.body;
    // answers: [{ questionNo: 1, selectedAnswer: 'ক' }, ...]

    const exam = await Exam.findById(req.params.id);
    if (!exam || !exam.isActive) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Build answer key map
    const answerKeyMap = {};
    exam.answerKey.forEach((ak) => {
      answerKeyMap[ak.questionNo] = ak.answer;
    });

    // Score calculation
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let score = 0;

    // Evaluate all questions against answer key
    const evaluatedAnswers = exam.answerKey.map((ak) => {
      const userAnswer = answers?.find((a) => a.questionNo === ak.questionNo);
      const selected = userAnswer?.selectedAnswer || null;

      if (!selected) {
        skipped++;
        return { questionNo: ak.questionNo, selectedAnswer: null };
      } else if (selected === ak.answer) {
        correct++;
        score += exam.marksPerMCQ;
        return { questionNo: ak.questionNo, selectedAnswer: selected };
      } else {
        wrong++;
        score -= exam.negativeMark || 0;
        return { questionNo: ak.questionNo, selectedAnswer: selected };
      }
    });

    // Clamp score to 0
    score = Math.max(0, Math.round(score * 100) / 100);
    const passed = score >= exam.passMarks;

    // Check if updating an existing submission (Retake)
    let submission = await Submission.findOne({
      userId: req.user._id,
      examId: exam._id,
    });

    const isRetake = !!submission;

    if (submission) {
      // ── Retake is strictly for practice! Main evaluation is the FIRST exam ──
      // Ensure the first exam snapshot is preserved
      if (!submission.firstAnswers || submission.firstAnswers.length === 0) {
        submission.firstAnswers = submission.answers;
        submission.firstScore = submission.score;
        submission.firstCorrect = submission.correct;
        submission.firstWrong = submission.wrong;
        submission.firstSkipped = submission.skipped;
        submission.firstPassed = submission.passed;
        submission.firstSubmittedAt = submission.submittedAt;
        submission.firstTimeTaken = submission.timeTaken;
      }

      // Record practice retake details without altering the official first exam evaluation
      submission.retakeCount = (submission.retakeCount || 0) + 1;
      submission.lastPracticeScore = score;
      submission.lastPracticeAnswers = evaluatedAnswers;
      submission.lastPracticeSubmittedAt = new Date();

      // Official evaluation (answers, score, passed, etc.) stays as the FIRST exam
    } else {
      // ── First attempt: this is the main official evaluation ──
      submission = new Submission({
        userId: req.user._id,
        examId: exam._id,
        answers: evaluatedAnswers,
        score,
        totalAttempted: correct + wrong,
        correct,
        wrong,
        skipped,
        passed,
        timeTaken: timeTaken || 0,
        submittedAt: new Date(),

        firstAnswers: evaluatedAnswers,
        firstScore: score,
        firstCorrect: correct,
        firstWrong: wrong,
        firstSkipped: skipped,
        firstPassed: passed,
        firstSubmittedAt: new Date(),
        firstTimeTaken: timeTaken || 0,
        retakeCount: 0,
      });
    }

    await submission.save();

    // Generate official result PDF on first attempt
    let localPdfPathForEmail = null;
    if (!isRetake || !submission.resultPdfPath) {
      const resultsDir = path.join(__dirname, '../uploads/results');
      if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

      try {
        const pdfResult = await generateResultPDF({
          user: req.user,
          exam,
          submission,
          outputDir: resultsDir,
        });

        localPdfPathForEmail = pdfResult.localPath;
        submission.resultPdfPath = pdfResult.publicUrl || pdfResult.localPath;
        await submission.save();
      } catch (pdfErr) {
        console.error('PDF generation error:', pdfErr.message);
      }
    }

    // Send result email to student (non-blocking)
    sendResultEmail(
      req.user.email,
      req.user.name,
      `${exam.title}${isRetake ? ' (Practice Retake Result)' : ''}`,
      score,
      exam.totalMarks,
      passed,
      localPdfPathForEmail
    ).catch((err) => console.error('Student email send error:', err.message));

    // If user participated for the first time, send student's answer result to admin's email as well
    if (!isRetake) {
      const adminEmail = process.env.ADMIN_EMAIL || process.env.MAIL_USER || 'safiullahforagy1@gmail.com';
      if (adminEmail) {
        sendAdminResultNotificationEmail({
          adminEmail,
          studentName: req.user.name,
          studentEmail: req.user.email,
          examTitle: exam.title,
          score,
          totalMarks: exam.totalMarks,
          passed,
          correct,
          wrong,
          skipped,
          timeTaken,
          pdfPath: localPdfPathForEmail,
        }).catch((err) => console.error('Admin result notification email error:', err.message));
      }
    }

    res.status(200).json({
      message: isRetake
        ? 'Practice retake submitted! Your official evaluation remains from your 1st exam attempt.'
        : 'Exam submitted successfully',
      isRetake,
      officialScore: submission.firstScore !== undefined ? submission.firstScore : submission.score,
      result: {
        score,
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        correct,
        wrong,
        skipped,
        passed,
        totalQuestions: exam.totalQuestions,
      },
    });
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
