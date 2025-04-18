/**
 * Rate Limiter Middleware
 * Limits request rates to prevent abuse
 * 
 *
 */

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('../config/redis');
require('dotenv').config();

/**
 * Create a Redis store with a unique prefix
 * @param {string} prefix - Unique prefix for the store
 * @returns {RedisStore} Redis store instance
 */
const createRedisStore = (prefix) => {
  return new RedisStore({
    client: redis.client,
    prefix: `rate-limit:${prefix}:`
  });
};

/**
 * Default rate limiter - 100 requests per 15 minutes
 */
const standard = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('standard'),
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  },
  skip: (req) => {
    // Skip rate limiting for specific routes or conditions if needed
    const skipIps = process.env.RATE_LIMIT_SKIP_IPS 
      ? process.env.RATE_LIMIT_SKIP_IPS.split(',') 
      : [];
    
    return skipIps.includes(req.ip);
  }
});

/**
 * Strict rate limiter - 20 requests per 15 minutes
 * For sensitive routes like login, registration, etc.
 */
const strict = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('strict'),
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  }
});

/**
 * Login rate limiter - 5 login attempts per 15 minutes
 */
const login = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('login'),
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes.'
  }
});

/**
 * Password reset rate limiter - 3 reset attempts per hour
 */
const passwordReset = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('passwordReset'),
  message: {
    success: false,
    error: 'Too many password reset attempts, please try again after 1 hour.'
  }
});

/**
 * Transaction rate limiter - 10 transactions per hour
 * For financial operations like deposits and withdrawals
 */
const transaction = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 transactions per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('transaction'),
  message: {
    success: false,
    error: 'Too many transaction attempts, please try again after 1 hour.'
  }
});

/**
 * SMS rate limiter - 5 SMS requests per day
 */
const sms = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // Limit each IP to 5 SMS requests per day
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('sms'),
  message: {
    success: false,
    error: 'SMS request limit reached, please try again tomorrow.'
  }
});

/**
 * API rate limiter - 1000 requests per hour
 * For public or external API endpoints
 */
const api = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each IP to 1000 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore('api'),
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
 * @param {string} prefix - Unique prefix for the Redis store
 * @returns {Object} Rate limiter middleware
 */
const createLimiter = (max = 100, windowMs = 15 * 60 * 1000, message = 'Rate limit exceeded', prefix = 'custom') => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(prefix),
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