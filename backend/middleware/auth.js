const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Validates JWT from HTTP-Only cookie or Authorization header.
 * Attaches authenticated user document to req.user.
 */
const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    // Support Bearer token fallback in headers
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing. Access denied.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey');
    const user = await User.findById(decoded.id || decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }
};

module.exports = { protect };
