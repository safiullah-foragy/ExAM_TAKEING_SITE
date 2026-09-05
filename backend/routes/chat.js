const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { protect } = require('../middleware/auth');
const { uploadToSupabase } = require('../utils/supabaseStorage');

// ─── Multer Storage for Chat Attachments ──────────────────────────────────────
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/chat');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${unique}_${safeName}`);
  },
});

const chatUpload = multer({
  storage: chatStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      return cb(null, true);
    }
    cb(new Error('Only images and PDF documents are allowed in chat'), false);
  },
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// Deterministic conversation ID generator
const getConversationId = (id1, id2) => [String(id1), String(id2)].sort().join('_');

// Helper to get sender details
const getSenderInfo = async (req) => {
  if (req.admin) {
    const email = (req.adminEmail || process.env.ADMIN_EMAIL || 'admin@authority.com').toLowerCase();
    let admin = await Admin.findOne({ email });
    if (!admin) {
      admin = await Admin.create({
        email,
        name: 'Exam Authority',
        title: 'Head Administrator',
      });
    }
    return {
      senderId: 'admin',
      senderModel: 'Admin',
      senderName: admin.name || 'Exam Authority',
      senderPhoto: admin.photo || null,
      senderRole: 'authority',
      senderTitle: admin.title || 'Head Administrator',
    };
  } else {
    const user = await User.findById(req.user._id).select('name photo email');
    return {
      senderId: user._id.toString(),
      senderModel: 'User',
      senderName: user.name,
      senderPhoto: user.photo || null,
      senderRole: 'student',
      senderTitle: 'Student',
    };
  }
};

// ─── GET /api/chat/unread-count ───────────────────────────────────────────────
// Get total unread messages for the logged-in student or admin
router.get('/unread-count', protect, async (req, res) => {
  try {
    const currentId = req.admin ? 'admin' : req.user._id.toString();
    const count = await Message.countDocuments({
      recipientId: currentId,
      isRead: false,
    });
    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Chat unread count error:', error);
    res.status(500).json({ message: 'Failed to count unread messages', error: error.message });
  }
});

// ─── GET /api/chat/conversations ──────────────────────────────────────────────
// Get summary of all conversations for the current user
router.get('/conversations', protect, async (req, res) => {
  try {
    const currentId = req.admin ? 'admin' : req.user._id.toString();

    // Find all distinct conversation IDs involving current user
    const convIds = await Message.distinct('conversationId', {
      $or: [{ senderId: currentId }, { recipientId: currentId }],
    });

    // Also get admin profile in case partner is admin
    const adminDoc = await Admin.findOne({
      email: (process.env.ADMIN_EMAIL || '').toLowerCase(),
    });
    const defaultAdmin = {
      name: adminDoc?.name || 'Exam Authority',
      title: adminDoc?.title || 'Head Administrator',
      photo: adminDoc?.photo || null,
    };

    const conversations = [];

    for (const cid of convIds) {
      // Find latest message in this conversation
      const lastMsg = await Message.findOne({ conversationId: cid }).sort({ createdAt: -1 });
      if (!lastMsg) continue;

      // Identify partner ID
      const partnerId = lastMsg.senderId === currentId ? lastMsg.recipientId : lastMsg.senderId;

      // Count unread messages sent by partner to current user
      const unreadCount = await Message.countDocuments({
        conversationId: cid,
        recipientId: currentId,
        isRead: false,
      });

      let partner = null;
      if (partnerId === 'admin') {
        partner = {
          _id: 'admin',
          name: defaultAdmin.name,
          title: defaultAdmin.title,
          photo: defaultAdmin.photo,
          role: 'authority',
        };
      } else {
        const u = await User.findById(partnerId).select('name email photo isActive isVerified');
        if (u) {
          partner = {
            _id: u._id.toString(),
            name: u.name,
            email: u.email,
            photo: u.photo || null,
            role: 'student',
            isActive: u.isActive !== false,
          };
        } else {
          partner = {
            _id: partnerId,
            name: 'Deleted User',
            email: '',
            photo: null,
            role: 'student',
            isActive: false,
          };
        }
      }

      conversations.push({
        conversationId: cid,
        partner,
        lastMessage: {
          _id: lastMsg._id,
          text: lastMsg.text,
          mediaType: lastMsg.mediaType,
          mediaName: lastMsg.mediaName,
          senderId: lastMsg.senderId,
          createdAt: lastMsg.createdAt,
          isRead: lastMsg.isRead,
        },
        unreadCount,
      });
    }

    // Sort by latest message desc
    conversations.sort(
      (a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
    );

    res.json({ conversations });
  } catch (error) {
    console.error('Fetch conversations error:', error);
    res.status(500).json({ message: 'Failed to fetch conversations', error: error.message });
  }
});

// ─── GET /api/chat/messages/:partnerId ────────────────────────────────────────
// Get full message history between current user and partner, and mark partner's msgs as read
router.get('/messages/:partnerId', protect, async (req, res) => {
  try {
    const currentId = req.admin ? 'admin' : req.user._id.toString();
    const partnerId = req.params.partnerId;

    const conversationId = getConversationId(currentId, partnerId);

    // Mark partner's unread messages as read
    await Message.updateMany(
      {
        conversationId,
        recipientId: currentId,
        isRead: false,
      },
      {
        $set: { isRead: true },
      }
    );

    // Fetch messages
    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });

    // Partner info
    let partner = null;
    if (partnerId === 'admin') {
      const adminDoc = await Admin.findOne({
        email: (process.env.ADMIN_EMAIL || '').toLowerCase(),
      });
      partner = {
        _id: 'admin',
        name: adminDoc?.name || 'Exam Authority',
        title: adminDoc?.title || 'Head Administrator',
        photo: adminDoc?.photo || null,
        role: 'authority',
      };
    } else {
      const u = await User.findById(partnerId).select('name email photo isActive');
      if (u) {
        partner = {
          _id: u._id.toString(),
          name: u.name,
          email: u.email,
          photo: u.photo || null,
          role: 'student',
          isActive: u.isActive !== false,
        };
      } else {
        partner = {
          _id: partnerId,
          name: 'Unknown / Deleted User',
          photo: null,
          role: 'student',
        };
      }
    }

    res.json({ messages, partner });
  } catch (error) {
    console.error('Fetch messages error:', error);
    res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
  }
});

// ─── POST /api/chat/message ───────────────────────────────────────────────────
// Send a message (text and/or media: image/pdf)
router.post('/message', protect, chatUpload.single('media'), async (req, res) => {
  try {
    const { recipientId, text } = req.body;

    if (!recipientId) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Recipient is required' });
    }

    if (!text && !req.file) {
      return res.status(400).json({ message: 'Message text or attachment is required' });
    }

    const sender = await getSenderInfo(req);
    const recipientModel = recipientId === 'admin' ? 'Admin' : 'User';

    let mediaUrl = null;
    let mediaType = null;
    let mediaName = null;

    if (req.file) {
      mediaName = req.file.originalname;
      mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'pdf';

      // Try uploading to Supabase
      try {
        const ext = path.extname(req.file.originalname);
        const destPath = `chat/${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
        mediaUrl = await uploadToSupabase(req.file.path, destPath, req.file.mimetype);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch (uploadErr) {
        console.warn('Supabase chat upload failed, falling back to local static URL:', uploadErr.message);
        // Fallback: keep local file in uploads/chat/
        mediaUrl = `/uploads/chat/${req.file.filename}`;
      }
    }

    const conversationId = getConversationId(sender.senderId, recipientId);

    const message = await Message.create({
      senderId: sender.senderId,
      senderModel: sender.senderModel,
      senderName: sender.senderName,
      senderPhoto: sender.senderPhoto,
      recipientId,
      recipientModel,
      conversationId,
      text: (text || '').trim(),
      mediaUrl,
      mediaType,
      mediaName,
      isRead: false,
    });

    res.status(201).json({
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
});

// ─── GET /api/chat/contacts ───────────────────────────────────────────────────
// List contacts (Authority + other active users) to start a new conversation
router.get('/contacts', protect, async (req, res) => {
  try {
    const currentId = req.admin ? 'admin' : req.user._id.toString();
    const contacts = [];

    // If current user is student, add Authority as first contact
    if (!req.admin) {
      const adminDoc = await Admin.findOne({
        email: (process.env.ADMIN_EMAIL || '').toLowerCase(),
      });
      contacts.push({
        _id: 'admin',
        name: adminDoc?.name || 'Exam Authority',
        title: adminDoc?.title || 'Head Administrator',
        photo: adminDoc?.photo || null,
        role: 'authority',
      });
    }

    // Fetch active, verified students (excluding self)
    const query = { isVerified: true, isActive: { $ne: false } };
    if (!req.admin) {
      query._id = { $ne: req.user._id };
    }

    const users = await User.find(query)
      .select('name email photo')
      .sort({ name: 1 })
      .limit(100);

    for (const u of users) {
      contacts.push({
        _id: u._id.toString(),
        name: u.name,
        email: u.email,
        photo: u.photo || null,
        role: 'student',
      });
    }

    res.json({ contacts });
  } catch (error) {
    console.error('Fetch contacts error:', error);
    res.status(500).json({ message: 'Failed to fetch contacts', error: error.message });
  }
});

module.exports = router;
