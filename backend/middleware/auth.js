const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'admin') {
      req.admin = true;
      return next();
    }

    const user = await User.findById(decoded.id).select('-otp -otpExpiry');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (!user.isVerified) {
      return res.status(401).json({ message: 'Account not verified' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

const adminOnly = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }
    if (!token) {
      return res.status(401).json({ message: 'Admin access required' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin only' });
    }
    req.admin = true;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid admin token' });
  }
};

module.exports = { protect, adminOnly };
