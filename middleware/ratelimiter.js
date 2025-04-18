/**
 * Rate Limiter Middleware
 * Limits request rates to prevent abuse
 * 
 *
 */
const rateLimit = require('express-rate-limit');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const RedisStore = require('rate-limit-redis');
const redisClient = require('../config/redis');

// Create a fallback limiter that doesn't use Redis
const createMemoryLimiter = (max, windowMinutes) => {
  return rateLimit({
    max,
    windowMs: windowMinutes * 60 * 1000,
    message: { status: 'error', message: 'Too many requests, please try again later.' }
  });
};

// Create Redis store only if Redis is connected
let limiterStore;
try {
  if (redisClient.isReady) {
    limiterStore = new RedisStore({
      // redis instance
      sendCommand: (...args) => redisClient.sendCommand(args),
    });
    console.log('Rate limiter using Redis store');
  } else {
    console.log('Rate limiter using memory store (Redis not connected)');
  }
} catch (err) {
  console.error('Error setting up Redis rate limiter:', err);
}

// Define your rate limiters
exports.apiLimiter = limiterStore 
  ? rateLimit({
      store: limiterStore,
      max: 100,
      windowMs: 15 * 60 * 1000,
      message: { status: 'error', message: 'Too many requests, please try again later.' }
    })
  : createMemoryLimiter(100, 15);

// Authentication rate limiter (stricter)
exports.authLimiter = limiterStore
  ? rateLimit({
      store: limiterStore,
      max: 5, // 5 attempts
      windowMs: 15 * 60 * 1000, // per 15 minutes
      message: { status: 'error', message: 'Too many login attempts, please try again later.' }
    })
  : createMemoryLimiter(5, 15);

// Registration rate limiter (very strict)
exports.registerLimiter = limiterStore
  ? rateLimit({
      store: limiterStore,
      max: 3, // 3 attempts
      windowMs: 60 * 60 * 1000, // per hour
      message: { status: 'error', message: 'Too many registration attempts, please try again later.' }
    })
  : createMemoryLimiter(3, 60);

// Transaction rate limiter
exports.transactionLimiter = limiterStore
  ? rateLimit({
      store: limiterStore,
      max: 10, // 10 transactions
      windowMs: 60 * 60 * 1000, // per hour
      message: { status: 'error', message: 'Too many transaction requests, please try again later.' }
    })
  : createMemoryLimiter(10, 60);

// SMS rate limiter
exports.smsLimiter = limiterStore
  ? rateLimit({
      store: limiterStore,
      max: 5, // 5 SMS
      windowMs: 24 * 60 * 60 * 1000, // per day
      message: { status: 'error', message: 'SMS sending limit reached, please try again tomorrow.' }
    })
  : createMemoryLimiter(5, 24 * 60);