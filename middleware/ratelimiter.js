/**
 * Rate Limiter Middleware
 * Limits request rates to prevent abuse
 *
 */
const rateLimit = require('express-rate-limit');

// Create rate limiters with different configurations
const standard = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  }
});

const strict = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  }
});

const login = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes.'
  }
});

const passwordReset = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again after 1 hour.'
  }
});

const transaction = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 transactions per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many transaction attempts, please try again after 1 hour.'
  }
});

const sms = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // Limit each IP to 5 SMS requests per day
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'SMS request limit reached, please try again tomorrow.'
  }
});

const api = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each IP to 1000 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'API rate limit exceeded, please try again later.'
  }
});

/**
 * Create a custom rate limiter
 * @param {number} max - Maximum number of requests
 * @param {number} windowMs - Time window in milliseconds
 * @param {string} message - Custom error message
 * @returns {Object} Rate limiter middleware
 */
const createLimiter = (max = 100, windowMs = 15 * 60 * 1000, message = 'Rate limit exceeded') => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: message
    }
  });
};

module.exports = {
  standard,
  strict,
  login,
  passwordReset,
  transaction,
  sms,
  api,
  createLimiter
};