const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Submission = require('../models/Submission');
const { protect } = require('../middleware/auth');
const { uploadToSupabase, deleteFromSupabase } = require('../utils/supabaseStorage');

// Temp photo upload storage
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/photos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `temp_photo_${req.user._id}_${Date.now()}${ext}`);
  },
});

const photoUpload = multer({
  storage: photoStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed'), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// ─── GET /api/user/profile ────────────────────────────────────────────────────
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-otp -otpExpiry');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Get user's submission history
    const submissions = await Submission.find({ userId: user._id })
      .populate('examId', 'title totalMarks passMarks totalTime author')
      .select('score passed correct wrong skipped submittedAt examId')
      .sort({ submittedAt: -1 });

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        photo: user.photo, // Public URL or relative path
        createdAt: user.createdAt,
      },
      submissions,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── PUT /api/user/photo ──────────────────────────────────────────────────────
router.put('/photo', protect, photoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo file provided' });
    }

    const user = await User.findById(req.user._id);

    // Delete old photo from Supabase if exists
    if (user.photo) {
      await deleteFromSupabase(user.photo);
    }

    // Upload to Supabase Storage
    const ext = path.extname(req.file.originalname);
    const destPath = `photos/user_${user._id}_${Date.now()}${ext}`;
    const publicUrl = await uploadToSupabase(req.file.path, destPath, req.file.mimetype);

    // Clean up local temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    user.photo = publicUrl;
    await user.save();

    res.json({ message: 'Photo updated successfully', photo: publicUrl });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ─── PUT /api/user/profile ────────────────────────────────────────────────────
router.put('/profile', protect, async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name.trim();
    await user.save();

    res.json({ message: 'Profile updated', user: { name: user.name } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
