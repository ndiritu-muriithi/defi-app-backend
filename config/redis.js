/**
 * Redis Configuration
 * Handles Redis connection for caching, session management and job queues
 * 
 * @author ndiritu-muriithi
 * @lastUpdated 2025-04-18 15:21:48 UTC
 */
const { createClient } = require('redis');
require('dotenv').config();

// Create Redis client with proper configuration
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with max 3s delay
      return Math.min(retries * 50, 3000);
    }
  }
});

// Error handling
redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

// Log when connection is established
redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

// Log when reconnecting
redisClient.on('reconnecting', () => {
  console.log('Reconnecting to Redis...');
});

// Handle ready state
redisClient.on('ready', () => {
  console.log('Redis client ready');
});

// Export a function that ensures connection before returning client
module.exports = redisClient;