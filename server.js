
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
const { setupEventListeners } = require('./services/blockchainservice');

// Import routes
const authRoutes = require('./routes/authroutes');
const goalRoutes = require('./routes/goalroutes');
const savingsRoutes = require('./routes/savingsroutes');
const notificationRoutes = require('./routes/notificationroutes');

// Import middleware
const { standard: apiLimiter } = require('./middleware/errorhandler');
const auth = require('./middleware/auth');
const admin = require('./middleware/admin');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('MongoDB connected successfully');

    // Setup blockchain event listeners
    await setupEventListeners();
    console.log('Blockchain event listeners setup complete');

    // Middleware
    app.use(helmet()); // Security headers
    app.use(cors({
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000', // Your frontend URL
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
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

    // ✅ Add root route to fix "Cannot GET /" error
    app.get('/', (req, res) => {
      res.send('Welcome to BazuuSave API!');
    });

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

module.exports = app; // For testing purposes
