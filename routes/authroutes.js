/**
 * Authentication Routes
 * Routes for user authentication, registration, and profile management
 * 
 * 
 */
const express = require('express');
const authController = require('../controllers/authcontroller');
const errorHandler = require('../controllers/errorhandler ');
const { authLimiter, registerLimiter } = require('../middleware/ratelimiter');
const auth = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', registerLimiter, validateRegister, authController.register);
router.post('/login', authLimiter, validateLogin, authController.login);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password/:token', authLimiter, authController.resetPassword);

// Protected routes (require authentication)
router.use(auth);
router.get('/me', authController.getMe);
router.patch('/update-me', authController.updateMe);
router.patch('/update-password', authController.updatePassword);
router.post('/logout', authController.logout);
router.post('/connect-wallet', authController.connectWallet);

module.exports = router;