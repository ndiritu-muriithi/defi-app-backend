/**
 * Admin Middleware
 * Validates that the authenticated user has admin privileges
 * 
 *
 */

/**
 * Admin check middleware
 * Ensures the user has admin role
 * Must be used after auth middleware
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const admin = (req, res, next) => {
    // Check if user exists and has admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.'
      });
    }
    
    next();
  };
  
  module.exports = admin;