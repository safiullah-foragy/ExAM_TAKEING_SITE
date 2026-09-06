const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');

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
    } else if (req.body && req.body.token) {
      token = req.body.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const isOfflineRoute = req.path === '/offline';

    if (decoded.role === 'admin') {
      req.admin = true;
      req.adminEmail = decoded.email;
      if (!isOfflineRoute) {
        Admin.updateOne(
          { email: decoded.email.toLowerCase() },
          { $set: { lastSeen: new Date(), isOnline: true } }
        ).exec().catch(() => {});
      }
      return next();
    }

    const user = await User.findById(decoded.id).select('-otp -otpExpiry');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (!user.isVerified) {
      return res.status(401).json({ message: 'Account not verified' });
    }
    if (user.isActive === false) {
      return res.status(403).json({
        message: 'Your account has been deactivated. Please contact the administrator.',
      });
    }

    req.user = user;
    if (!isOfflineRoute) {
      User.updateOne(
        { _id: user._id },
        { $set: { lastSeen: new Date(), isOnline: true } }
      ).exec().catch(() => {});
    }

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
    req.adminEmail = decoded.email;
    Admin.updateOne(
      { email: decoded.email.toLowerCase() },
      { $set: { lastSeen: new Date() } }
    ).exec().catch(() => {});
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid admin token' });
  }
};

module.exports = { protect, adminOnly };
