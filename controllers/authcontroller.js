/**
 * Authentication Controller
 * Handles user authentication, registration, and profile management
 * 
 * @author ndiritu-muriithi
 * @lastUpdated 2025-04-18 08:33:05 UTC
 */

const user = require('../models/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { bazuuSaveContractReadOnly } = require('../config/blockchain');
require('dotenv').config();

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

// In-memory session store
const sessionStore = new Map();

/**
 * Register a new user
 * @route POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, phoneNumber } = req.body;

    // Check if user already exists
    const existingUser = await user.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = await user.create({
      name,
      email,
      password: hashedPassword,
      phoneNumber
    });

    // Generate tokens
    const token = generateToken(newUser._id);
    const refreshToken = generateRefreshToken(newUser._id);

    // Store refresh token in memory
    sessionStore.set(newUser._id.toString(), refreshToken);

    res.status(201).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const existingUser = await user.findOne({ email });
    if (!existingUser) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate tokens
    const token = generateToken(existingUser._id);
    const refreshToken = generateRefreshToken(existingUser._id);

    // Store refresh token in memory
    sessionStore.set(existingUser._id.toString(), refreshToken);

    res.status(200).json({
      success: true,
      token,
      refreshToken,
      user: {
        id: existingUser._id,
        name: existingUser.name,
        email: existingUser.email,
        phoneNumber: existingUser.phoneNumber
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/profile
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // If user has a wallet address, fetch on-chain balance
    let onChainBalance = null;
    if (user.walletAddress && ethers.isAddress(user.walletAddress)) {
      try {
        onChainBalance = await bazuuSaveContractReadOnly.getBalance(user.walletAddress);
        onChainBalance = ethers.formatUnits(onChainBalance, 6); // USDC has 6 decimals
      } catch (err) {
        console.error('Error fetching on-chain balance:', err);
        // Don't fail the entire request if blockchain is unavailable
      }
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        walletAddress: user.walletAddress,
        onChainBalance: onChainBalance,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching user profile'
    });
  }
};

/**
 * Update user profile
 * @route PUT /api/auth/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phoneNumber, walletAddress } = req.body;
    
    // Fields to update
    const fieldsToUpdate = {};
    if (name) fieldsToUpdate.name = name;
    if (phoneNumber) fieldsToUpdate.phoneNumber = phoneNumber;
    
    // Validate wallet address if provided
    if (walletAddress) {
      if (!ethers.isAddress(walletAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid Ethereum wallet address'
        });
      }
      fieldsToUpdate.walletAddress = walletAddress;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating profile'
    });
  }
};

/**
 * Change password
 * @route PUT /api/auth/password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error changing password'
    });
  }
};

/**
 * Refresh token
 * @route POST /api/auth/refresh
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'No refresh token provided'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const userId = decoded.id;

    // Check if refresh token exists in store
    const storedToken = sessionStore.get(userId);
    if (!storedToken || storedToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newToken = generateToken(userId);
    const newRefreshToken = generateRefreshToken(userId);

    // Update refresh token in store
    sessionStore.set(userId, newRefreshToken);

    res.status(200).json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 */
exports.logout = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Remove refresh token from store
    sessionStore.delete(userId);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
};

/**
 * Reset password request
 * @route POST /api/auth/reset-password-request
 */
exports.resetPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link'
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Set expiration (1 hour)
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
    
    await user.save();
    
    // Send notification (will implement in notificationController)
    // For now, just return the token (in production, this would be sent via email/SMS)
    res.status(200).json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link',
      resetToken // Remove this in production
    });
  } catch (error) {
    console.error('Reset password request error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error requesting password reset'
    });
  }
};

/**
 * Reset password
 * @route POST /api/auth/reset-password/:token
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    // Check Redis first (faster)
    const userId = await redis.getCache(`reset_token:${token}`);
    
    if (!userId) {
      // Fall back to database check
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpire: { $gt: Date.now() }
      });
      
      if (!user) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token'
        });
      }
      
      // Update password
      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      
      await user.save();
      
      // Delete from Redis if it was added later
      await redis.deleteCache(`reset_token:${token}`);
      
      return res.status(200).json({
        success: true,
        message: 'Password reset successful'
      });
    }
    
    // If found in Redis, update user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();
    
    // Delete token from Redis
    await redis.deleteCache(`reset_token:${token}`);
    
    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error resetting password'
    });
  }
};

/**
 * Connect wallet address
 * @route POST /api/auth/connect-wallet
 */
exports.connectWallet = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    
    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum wallet address'
      });
    }
    
    // Verify signature - ensure the wallet owner signed the message
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature'
        });
      }
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature format'
      });
    }
    
    // Check if wallet is already connected to another account
    const existingUser = await User.findOne({ walletAddress });
    if (existingUser && existingUser._id.toString() !== req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address already connected to another account'
      });
    }
    
    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { walletAddress },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        walletAddress: user.walletAddress
      }
    });
  } catch (error) {
    console.error('Connect wallet error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error connecting wallet'
    });
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update current user profile
 * @route PATCH /api/auth/update-me
 */
exports.updateMe = async (req, res) => {
  try {
    const { name, email, phoneNumber } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    user.name = name || user.name;
    user.email = email || user.email;
    user.phoneNumber = phoneNumber || user.phoneNumber;

    await user.save();
    res.json(user);
  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Update user password
 * @route PATCH /api/auth/update-password
 */
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * Request password reset
 * @route POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = resetTokenExpiry;
    await user.save();

    // TODO: Send reset email
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Helper Functions

/**
 * Generate JWT token
 * @param {string} userId - User ID
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE
  });
};

/**
 * Generate refresh token
 * @param {string} userId - User ID
 * @returns {string} Refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRE
  });
};