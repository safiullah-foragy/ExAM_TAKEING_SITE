const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const { adminOnly } = require('../middleware/auth');
const { parseAnswerCSV } = require('../utils/csvParser');
const { uploadToSupabase, deleteFromSupabase } = require('../utils/supabaseStorage');
const { sendNewExamNotificationEmail } = require('../utils/mailer');
const { generateMasterExamResultPDF } = require('../utils/pdfGenerator');

// ─── Multer Temp Storage ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/pdfs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}_${file.originalname.replace(/\s+/g, '_')}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'questionPdf') {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    return cb(new Error('Question file must be a PDF'), false);
  }
  if (file.fieldname === 'answerCsv') {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv')
    ) {
      return cb(null, true);
    }
    return cb(new Error('Answer file must be a CSV'), false);
  }
  cb(null, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// ─── POST /api/admin/login ────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign(
      { role: 'admin', email },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    return res.json({ message: 'Admin login successful', token });
  }
  res.status(401).json({ message: 'Invalid admin credentials' });
});

// ─── POST /api/admin/exam ─────────────────────────────────────────────────────
router.post(
  '/exam',
  adminOnly,
  upload.fields([
    { name: 'questionPdf', maxCount: 1 },
    { name: 'answerCsv', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, author, totalTime, totalMarks, passMarks, marksPerMCQ, negativeMark, totalQuestions } = req.body;

      if (!title || !author || !totalTime || !totalMarks || !passMarks) {
        return res.status(400).json({ message: 'All exam fields are required' });
      }

      if (!req.files?.questionPdf) {
        return res.status(400).json({ message: 'Question PDF is required' });
      }
      if (!req.files?.answerCsv) {
        return res.status(400).json({ message: 'Answer CSV is required' });
      }

      const pdfFile = req.files.questionPdf[0];
      const csvFile = req.files.answerCsv[0];

      // Parse CSV answer key
      let answerKey;
      try {
        answerKey = parseAnswerCSV(csvFile.path);
      } catch (csvErr) {
        // Cleanup uploaded files
        if (fs.existsSync(pdfFile.path)) fs.unlinkSync(pdfFile.path);
        if (fs.existsSync(csvFile.path)) fs.unlinkSync(csvFile.path);
        return res.status(400).json({ message: `CSV parse error: ${csvErr.message}` });
      }

      // Clean up CSV file (answers are stored in DB)
      if (fs.existsSync(csvFile.path)) fs.unlinkSync(csvFile.path);

      // Determine requested question count
      const parsedMarksPerMCQ = marksPerMCQ ? Number(marksPerMCQ) : 1;
      const expectedQuestions = totalQuestions
        ? Number(totalQuestions)
        : Math.round(Number(totalMarks) / parsedMarksPerMCQ);

      // If CSV has more questions than specified/expected, limit to the requested question count
      if (expectedQuestions > 0 && answerKey.length > expectedQuestions) {
        answerKey = answerKey.slice(0, expectedQuestions);
      }

      // Upload Question PDF to Supabase Storage (with local server storage fallback)
      const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
      const destPath = `pdfs/${unique}_${pdfFile.originalname.replace(/\s+/g, '_')}`;
      let publicPdfUrl;
      try {
        publicPdfUrl = await uploadToSupabase(pdfFile.path, destPath, 'application/pdf');
        // Clean up local temp PDF file if uploaded to cloud
        if (fs.existsSync(pdfFile.path)) fs.unlinkSync(pdfFile.path);
      } catch (uploadErr) {
        console.error('Supabase upload failed, falling back to local server storage:', uploadErr.message);
        // Fallback: keep local file in /uploads/pdfs/ and serve statically
        publicPdfUrl = `/uploads/pdfs/${path.basename(pdfFile.path)}`;
      }

      const exam = new Exam({
        title: title.trim(),
        author: author.trim(),
        totalTime: Number(totalTime),
        totalMarks: Number(totalMarks),
        passMarks: Number(passMarks),
        marksPerMCQ: parsedMarksPerMCQ,
        negativeMark: negativeMark ? Number(negativeMark) : 0,
        pdfPath: publicPdfUrl,
        pdfOriginalName: pdfFile.originalname,
        totalQuestions: answerKey.length,
        answerKey,
      });

      await exam.save();

      // Send email notification to all registered & verified users
      User.find({ isVerified: true })
        .select('name email')
        .then((users) => {
          console.log(`Sending new exam notification to ${users.length} users...`);
          users.forEach((u) => {
            sendNewExamNotificationEmail(u.email, u.name, exam).catch((err) =>
              console.error(`Failed to send email to ${u.email}:`, err.message)
            );
          });
        })
        .catch((err) => console.error('Error fetching users for notification:', err.message));

      res.status(201).json({
        message: 'Exam created successfully and invitation emails sent to all students!',
        exam: {
          _id: exam._id,
          title: exam.title,
          author: exam.author,
          totalTime: exam.totalTime,
          totalMarks: exam.totalMarks,
          passMarks: exam.passMarks,
          marksPerMCQ: exam.marksPerMCQ,
          totalQuestions: exam.totalQuestions,
          pdfUrl: publicPdfUrl,
          createdAt: exam.createdAt,
        },
      });
    } catch (error) {
      console.error('Create exam error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// ─── GET /api/admin/exams ─────────────────────────────────────────────────────
router.get('/exams', adminOnly, async (req, res) => {
  try {
    const exams = await Exam.find()
      .select('-answerKey')
      .sort({ createdAt: -1 });
    res.json({ exams });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /api/admin/exam/:id ──────────────────────────────────────────────────
router.get('/exam/:id', adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    res.json({ exam });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── PUT /api/admin/exam/:id ──────────────────────────────────────────────────
router.put('/exam/:id', adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const { title, author, totalTime, totalMarks, passMarks, marksPerMCQ, negativeMark, totalQuestions } = req.body;

    if (title) exam.title = title.trim();
    if (author) exam.author = author.trim();
    if (totalTime !== undefined && totalTime !== '') exam.totalTime = Number(totalTime);
    if (totalMarks !== undefined && totalMarks !== '') exam.totalMarks = Number(totalMarks);
    if (passMarks !== undefined && passMarks !== '') exam.passMarks = Number(passMarks);
    if (marksPerMCQ !== undefined && marksPerMCQ !== '') exam.marksPerMCQ = Number(marksPerMCQ);
    if (negativeMark !== undefined && negativeMark !== '') exam.negativeMark = Number(negativeMark);
    if (totalQuestions !== undefined && totalQuestions !== '') {
      const qNum = Number(totalQuestions);
      exam.totalQuestions = qNum;
      if (exam.answerKey && exam.answerKey.length > qNum) {
        exam.answerKey = exam.answerKey.slice(0, qNum);
      }
    }

    await exam.save();

    res.json({ message: 'Exam updated successfully', exam });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── PUT /api/admin/exam/:id/toggle ──────────────────────────────────────────
router.put('/exam/:id/toggle', adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });
    exam.isActive = !exam.isActive;
    await exam.save();
    res.json({ message: `Exam ${exam.isActive ? 'activated' : 'deactivated'}`, isActive: exam.isActive });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── DELETE /api/admin/exam/:id ───────────────────────────────────────────────
router.delete('/exam/:id', adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    // Delete PDF from Supabase Storage or local
    if (exam.pdfPath) {
      if (exam.pdfPath.startsWith('http')) {
        await deleteFromSupabase(exam.pdfPath);
      } else if (fs.existsSync(exam.pdfPath)) {
        fs.unlinkSync(exam.pdfPath);
      }
    }

    await Exam.findByIdAndDelete(req.params.id);
    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /api/admin/exam/:id/participants ─────────────────────────────────────
router.get('/exam/:id/participants', adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    // Get all submissions for this exam, sorted by highest score
    const submissions = await Submission.find({ examId: exam._id })
      .populate('userId', 'name email photo')
      .sort({ score: -1, submittedAt: -1 });

    const attendedUserIds = new Set();
    const participants = [];

    submissions.forEach((sub) => {
      if (sub.userId) {
        attendedUserIds.add(sub.userId._id.toString());
        participants.push({
          submissionId: sub._id,
          user: {
            _id: sub.userId._id,
            name: sub.userId.name,
            email: sub.userId.email,
            photo: sub.userId.photo,
          },
          score: sub.score,
          passed: sub.passed,
          correct: sub.correct,
          wrong: sub.wrong,
          skipped: sub.skipped,
          timeTaken: sub.timeTaken,
          submittedAt: sub.submittedAt,
          resultPdfPath: sub.resultPdfPath,
        });
      }
    });

    // Get all verified users who have NOT submitted this exam
    const allUsers = await User.find({ isVerified: true }).select('name email photo createdAt');
    const remaining = allUsers
      .filter((u) => !attendedUserIds.has(u._id.toString()))
      .map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        photo: u.photo,
        joinedAt: u.createdAt,
      }));

    res.json({
      exam: {
        _id: exam._id,
        title: exam.title,
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        totalQuestions: exam.totalQuestions,
      },
      participants,
      remaining,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── GET /api/admin/exam/:id/master-result-pdf ─────────────────────────────────
router.get('/exam/:id/master-result-pdf', adminOnly, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ message: 'Exam not found' });

    const submissions = await Submission.find({ examId: exam._id })
      .populate('userId', 'name email')
      .sort({ score: -1, submittedAt: -1 });

    const participants = submissions
      .filter((s) => s.userId)
      .map((s) => ({
        user: { name: s.userId.name, email: s.userId.email },
        score: s.score,
        passed: s.passed,
        correct: s.correct,
        wrong: s.wrong,
        submittedAt: s.submittedAt,
      }));

    const pdfBuffer = await generateMasterExamResultPDF({ exam, participants });

    const sanitizedTitle = exam.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizedTitle}_Results.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating master results PDF:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
