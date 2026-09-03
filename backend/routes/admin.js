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
const { uploadToGridFS, deleteFromGridFS, existsInGridFS } = require('../utils/gridfsStorage');
const { sendNewExamNotificationEmail, sendBroadcastEmail } = require('../utils/mailer');
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
      const {
        title,
        author,
        totalTime,
        totalMarks,
        passMarks,
        marksPerMCQ,
        negativeMark,
        totalQuestions,
      } = req.body;

      if (!title || !author || !totalTime || !totalMarks || !passMarks) {
        return res.status(400).json({ message: 'All required fields must be filled' });
      }

      if (!req.files?.questionPdf) {
        return res.status(400).json({ message: 'Question PDF file is required' });
      }

      if (!req.files?.answerCsv) {
        return res.status(400).json({ message: 'Answer key CSV file is required' });
      }

      const pdfFile = req.files.questionPdf[0];
      const csvFile = req.files.answerCsv[0];

      // Parse CSV
      let answerKey;
      try {
        answerKey = await parseAnswerCSV(csvFile.path);
      } catch (parseErr) {
        if (fs.existsSync(csvFile.path)) fs.unlinkSync(csvFile.path);
        return res.status(400).json({ message: parseErr.message });
      }

      // Clean up CSV temp file
      if (fs.existsSync(csvFile.path)) fs.unlinkSync(csvFile.path);

      if (!answerKey || answerKey.length === 0) {
        return res.status(400).json({ message: 'Answer key CSV has no valid rows' });
      }

      // Determine requested question count
      const parsedMarksPerMCQ = marksPerMCQ ? Number(marksPerMCQ) : 1;
      const expectedQuestions = totalQuestions
        ? Number(totalQuestions)
        : Math.round(Number(totalMarks) / parsedMarksPerMCQ);

      // If CSV has more questions than specified/expected, limit to the requested question count
      if (expectedQuestions > 0 && answerKey.length > expectedQuestions) {
        answerKey = answerKey.slice(0, expectedQuestions);
      }

      // 1. Always store Question PDF persistently in MongoDB GridFS
      let gridFsFileId = null;
      try {
        const gridResult = await uploadToGridFS(pdfFile.path, pdfFile.originalname, 'application/pdf');
        gridFsFileId = gridResult.fileId;
      } catch (gridErr) {
        console.error('GridFS storage error:', gridErr.message);
      }

      // 2. Also upload to Supabase Storage if configured
      const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
      const destPath = `pdfs/${unique}_${pdfFile.originalname.replace(/\s+/g, '_')}`;
      let publicPdfUrl = null;
      try {
        publicPdfUrl = await uploadToSupabase(pdfFile.path, destPath, 'application/pdf');
      } catch (uploadErr) {
        console.warn('Supabase upload not used or failed:', uploadErr.message);
      }

      const exam = new Exam({
        title: title.trim(),
        author: author.trim(),
        totalTime: Number(totalTime),
        totalMarks: Number(totalMarks),
        passMarks: Number(passMarks),
        marksPerMCQ: parsedMarksPerMCQ,
        negativeMark: negativeMark ? Number(negativeMark) : 0,
        pdfPath: publicPdfUrl || `/uploads/pdfs/${path.basename(pdfFile.path)}`,
        pdfGridFSId: gridFsFileId,
        pdfOriginalName: pdfFile.originalname,
        totalQuestions: answerKey.length,
        answerKey,
      });

      await exam.save();

      // If not on Supabase, point pdfPath directly to the streaming endpoint
      if (!publicPdfUrl) {
        exam.pdfPath = `/api/exam/${exam._id}/pdf`;
        await exam.save();
      }

      // Clean up local temp file if safely stored in GridFS or Supabase
      if (gridFsFileId || publicPdfUrl) {
        try { if (fs.existsSync(pdfFile.path)) fs.unlinkSync(pdfFile.path); } catch {}
      }

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
          pdfUrl: exam.pdfPath,
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
router.put('/exam/:id', adminOnly, upload.single('questionPdf'), async (req, res) => {
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

    // Handle optional Question PDF update / replacement
    if (req.file) {
      const pdfFile = req.file;

      // 1. Upload to GridFS
      try {
        const gridResult = await uploadToGridFS(pdfFile.path, pdfFile.originalname, 'application/pdf');
        if (exam.pdfGridFSId) {
          await deleteFromGridFS(exam.pdfGridFSId);
        }
        exam.pdfGridFSId = gridResult.fileId;
      } catch (gridErr) {
        console.error('GridFS replacement failed:', gridErr.message);
      }

      // 2. Upload to Supabase if configured
      const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
      const destPath = `pdfs/${unique}_${pdfFile.originalname.replace(/\s+/g, '_')}`;
      let publicPdfUrl = null;
      try {
        publicPdfUrl = await uploadToSupabase(pdfFile.path, destPath, 'application/pdf');
        if (exam.pdfPath && exam.pdfPath.startsWith('http')) {
          await deleteFromSupabase(exam.pdfPath);
        }
      } catch (supaErr) {
        console.warn('Supabase upload not used:', supaErr.message);
      }

      exam.pdfOriginalName = pdfFile.originalname;
      exam.pdfPath = publicPdfUrl || `/api/exam/${exam._id}/pdf`;

      if (exam.pdfGridFSId || publicPdfUrl) {
        try { if (fs.existsSync(pdfFile.path)) fs.unlinkSync(pdfFile.path); } catch {}
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

    // Delete PDF from GridFS
    if (exam.pdfGridFSId) {
      await deleteFromGridFS(exam.pdfGridFSId);
    }

    // Delete PDF from Supabase Storage or local
    if (exam.pdfPath) {
      if (exam.pdfPath.startsWith('http')) {
        await deleteFromSupabase(exam.pdfPath);
      } else {
        const localPath = path.isAbsolute(exam.pdfPath)
          ? exam.pdfPath
          : path.join(__dirname, '..', exam.pdfPath.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          try { fs.unlinkSync(localPath); } catch {}
        }
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

// ─── Multer Mail Attachment Storage (In-Memory for Cloud & Serverless) ─────
const mailFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    return cb(null, true);
  }
  return cb(new Error('Only PDF documents or image files (JPG, PNG, WebP, GIF) are allowed'), false);
};

const mailUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: mailFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

// ─── GET /api/admin/mail/stats ────────────────────────────────────────────────
router.get('/mail/stats', adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    res.json({ totalUsers, verifiedUsers });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching recipient stats', error: error.message });
  }
});

// ─── POST /api/admin/mail/send ───────────────────────────────────────────────
router.post(
  '/mail/send',
  adminOnly,
  (req, res, next) => {
    mailUpload.single('attachment')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Attachment file size exceeds 25MB limit' });
        }
        return res.status(400).json({ message: err.message });
      } else if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    const file = req.file;
    try {
      const { subject, message, audience, customEmail } = req.body;

      if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
        return res.status(500).json({
          message: 'Server email credentials are not configured. Please ensure MAIL_USER and MAIL_PASS are set in your hosting environment variables.',
        });
      }

      if (!subject || !subject.trim()) {
        return res.status(400).json({ message: 'Subject is required' });
      }

      if (!message || !message.trim()) {
        return res.status(400).json({ message: 'Message content is required' });
      }

      let recipients = [];

      if (audience === 'custom') {
        if (!customEmail || !customEmail.includes('@')) {
          return res.status(400).json({ message: 'Please provide a valid email address for custom recipient' });
        }
        recipients = [{ email: customEmail.trim(), name: 'Admin / Tester' }];
      } else if (audience === 'all') {
        recipients = await User.find().select('name email');
      } else {
        // Default: only verified users
        recipients = await User.find({ isVerified: true }).select('name email');
      }

      if (!recipients || recipients.length === 0) {
        return res.status(400).json({ message: 'No recipients found for the selected audience' });
      }

      const attachmentData = file
        ? {
            filename: file.originalname,
            buffer: file.buffer,
            contentType: file.mimetype,
          }
        : null;

      let sentCount = 0;
      let failCount = 0;
      const errors = [];

      // Send to recipients concurrently in batches of 5 to respect serverless timeouts & rate limits
      const BATCH_SIZE = 5;
      for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((recipient) =>
            sendBroadcastEmail({
              to: recipient.email,
              name: recipient.name,
              subject: subject.trim(),
              message: message.trim(),
              attachment: attachmentData,
            })
          )
        );

        results.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            sentCount++;
          } else {
            failCount++;
            const errMsg = result.reason?.message || 'Email sending failed';
            console.error(`Failed to send broadcast mail to ${batch[idx].email}:`, errMsg);
            errors.push({ email: batch[idx].email, error: errMsg });
          }
        });
      }

      if (sentCount === 0 && failCount > 0) {
        const firstErrMsg = errors[0]?.error || 'Failed to dispatch email';
        return res.status(500).json({
          message: `Delivery failed: ${firstErrMsg}`,
          total: recipients.length,
          sentCount: 0,
          failCount,
          errors: errors.slice(0, 5),
        });
      }

      res.json({
        message: `Broadcast completed: ${sentCount} sent successfully${failCount > 0 ? `, ${failCount} failed` : ''}.`,
        total: recipients.length,
        sentCount,
        failCount,
        errors: errors.slice(0, 5),
      });
    } catch (error) {
      console.error('Admin broadcast mail error:', error);
      res.status(500).json({ message: error.message || 'Failed to send broadcast mail', error: error.message });
    }
  }
);

module.exports = router;

