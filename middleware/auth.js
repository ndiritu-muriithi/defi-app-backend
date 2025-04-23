/**
 * Authentication Middleware
 * Validates JWT tokens and sets the user object on the request
 * 
 *
 */

const jwt = require('jsonwebtoken');
const User = require('../models/user');
require('dotenv').config();

// In-memory token blacklist
const tokenBlacklist = new Set();

/**
 * Authentication middleware
 * Verifies JWT token and adds user to request object
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked.'
      });
    }
    
    // Find user
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found or token is invalid.'
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Please contact support.'
      });
    }
    
    // Add user and token to request
    req.user = user;
    req.token = token;
    
    // Check and update last login time if needed
    if (!user.lastLogin || new Date() - user.lastLogin > 24 * 60 * 60 * 1000) {
      // Only update if last login was more than 24 hours ago
      user.lastLogin = new Date();
      await user.save();
    }
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired. Please log in again.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Server error during authentication.'
    });
  }
};

// Export auth middleware and blacklist management functions
module.exports = {
  auth,
  blacklistToken: (token) => tokenBlacklist.add(token),
  isTokenBlacklisted: (token) => tokenBlacklist.has(token),
  clearBlacklist: () => tokenBlacklist.clear()
};