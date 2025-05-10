/**
 * MongoDB Configuration
 * Handles database connection and configuration
 */
const mongoose = require('mongoose');
require('dotenv').config();

// Environment variables for MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bazuusave';

// MongoDB Atlas specific options
const DB_OPTIONS = {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  family: 4,  // Use IPv4
  // Add these options for better Atlas compatibility
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
};

// Array to store connection states for logging/debugging
const STATES = [
  'disconnected',
  'connected',
  'connecting',
  'disconnecting'
];

// Connect to MongoDB
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Connection string:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Hide credentials in logs
    
    const conn = await mongoose.connect(MONGODB_URI, DB_OPTIONS);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
    console.log(`Connection state: ${STATES[conn.connection.readyState]}`);
    
    // Set up connection event listeners
    mongoose.connection.on('connected', () => {
      console.log(`MongoDB connection established. State: ${STATES[mongoose.connection.readyState]}`);
    });
    
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB connection disconnected');
    });
    
    // Handle process termination and properly close MongoDB connection
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.error('Connection string used:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Hide credentials in logs
    process.exit(1);
  }
};

// Check if connected
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

// Get current connection state
const getConnectionState = () => {
  return STATES[mongoose.connection.readyState];
};

module.exports = {
  connectDB,
  isConnected,
  getConnectionState
};