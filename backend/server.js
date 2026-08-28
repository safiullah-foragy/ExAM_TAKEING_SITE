const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const examRoutes = require('./routes/exam');
const userRoutes = require('./routes/user');

const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      origin.includes('localhost') ||
      origin.includes('vercel.app') ||
      (process.env.CLIENT_URL && origin === process.env.CLIENT_URL)
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then((conn) => {
    const isCloud = conn.connection.host.includes('mongodb.net');
    console.log(`✅ MongoDB connected: ${isCloud ? '☁️ MongoDB Atlas (' + conn.connection.host + ')' : '🖥️ Local MongoDB (' + conn.connection.host + ')'}`);
    console.log(`📦 Database: ${conn.connection.name}`);
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
