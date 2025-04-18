/**
 * BazuuSave API Server
 * Main entry point for the BazuuSave DeFi application backend
 * 
 */

// Import dependencies
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Import configurations.
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { setupEventListeners } = require('./services/blockchainservice');

// Import routes
const authRoutes = require('./routes/authroutes');
const goalRoutes = require('./routes/goalroutes');
const savingsRoutes = require('./routes/savingsroutes');
const notificationRoutes = require('./routes/notificationroutes');

// Import middleware
const errorHandler = require('./middleware/errorhandler');
const { standard: apiLimiter } = require('./middleware/ratelimiter');
const auth = require('./middleware/auth')
const admin = require('./middleware/admin')

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB and Redis, then start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('MongoDB connected successfully');

    // Connect to Redis
    await connectRedis();
    console.log('Redis connected successfully');
    // Update this section in your server.js file

// Connect to Redis with error handling
(async () => {
  try {
    await redisClient.connect();
    console.log('Redis connected successfully');
  } catch (err) {
    console.error('Redis connection failed:', err.message);
    console.log('Continuing without Redis - some features may be limited');
    // Continue application execution even if Redis fails
  }
})();

// Then later in your server.js file, modify the listener setup to check if Redis is connected
const setupServices = async () => {
  try {
    // Only setup blockchain listeners if Redis is connected
    if (redisClient.isReady) {
      await setupBlockchainListeners();
      console.log('Blockchain listeners set up successfully');
    } else {
      console.log('Skipping blockchain listeners due to Redis connection issues');
    }
  } catch (err) {
    console.error('Failed to setup services:', err);
  }
};

setupServices();
    // Setup blockchain event listeners
    await setupEventListeners();
    console.log('Blockchain event listeners setup complete');

    // Middleware
    app.use(helmet()); // Security headers
    app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(morgan('dev'));
    app.use(compression());

    // Apply rate limiting to all routes
    app.use(apiLimiter);

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/goals', goalRoutes);
    app.use('/api/savings', savingsRoutes);
    app.use('/api/notifications', notificationRoutes);

    // Error handling
    app.use(errorHandler);

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  process.exit(0);
});

module.exports = app; // For testing purposes