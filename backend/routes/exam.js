const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const { protect } = require('../middleware/auth');
const { generateResultPDF } = require('../utils/pdfGenerator');
const { sendResultEmail } = require('../utils/mailer');
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
      submissionMap[sub.examId.toString()] = {
        score: sub.score,
        passed: sub.passed,
        correct: sub.correct,
        wrong: sub.wrong,
        skipped: sub.skipped,
        submittedAt: sub.submittedAt,
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
    if (!exam || !exam.isActive) {
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

// ─── GET /api/exam/:id/pdf ────────────────────────────────────────────────────
// Stream question PDF directly from GridFS, local disk, or redirect to cloud URL
router.get('/:id/pdf', protect, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam || !exam.isActive) {
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
      // Remove old result PDF from Supabase Storage or local disk
      if (submission.resultPdfPath) {
        if (submission.resultPdfPath.startsWith('http')) {
          await deleteFromSupabase(submission.resultPdfPath);
        } else if (fs.existsSync(submission.resultPdfPath)) {
          try { fs.unlinkSync(submission.resultPdfPath); } catch {}
        }
      }

      submission.answers = evaluatedAnswers;
      submission.score = score;
      submission.totalAttempted = correct + wrong;
      submission.correct = correct;
      submission.wrong = wrong;
      submission.skipped = skipped;
      submission.passed = passed;
      submission.timeTaken = timeTaken || 0;
      submission.submittedAt = new Date();
    } else {
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
      });
    }

    await submission.save();

    // Generate updated result PDF (and upload to Supabase Storage)
    const resultsDir = path.join(__dirname, '../uploads/results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    let pdfResult = null;
    let localPdfPathForEmail = null;

    try {
      pdfResult = await generateResultPDF({
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

    // Send updated result email (non-blocking)
    sendResultEmail(
      req.user.email,
      req.user.name,
      `${exam.title}${isRetake ? ' (Updated Result)' : ''}`,
      score,
      exam.totalMarks,
      passed,
      localPdfPathForEmail
    ).catch((err) => console.error('Email send error:', err.message));

    res.status(200).json({
      message: isRetake ? 'Exam re-submitted and score updated!' : 'Exam submitted successfully',
      isRetake,
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
