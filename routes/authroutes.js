/**
 * Authentication Routes
 * Routes for user authentication, registration, and profile management
 * 
 * 
 */
const express = require('express');
const authController = require('../controllers/authcontroller');
const errorHandler = require('../middleware/errorhandler');
const { standard, login, passwordReset } = require('../middleware/ratelimiter');
const { auth } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/register', standard, validateRegister, authController.register);
router.post('/login', login, validateLogin, authController.login);
router.post('/forgot-password', passwordReset, authController.forgotPassword);
router.post('/reset-password/:token', passwordReset, authController.resetPassword);

// Protected routes (require authentication)
router.use(auth);
router.get('/me', authController.getMe);
router.patch('/update-me', authController.updateMe);
router.patch('/update-password', authController.updatePassword);
router.post('/logout', authController.logout);
router.post('/connect-wallet', authController.connectWallet);

module.exports = router;