/**
 * User Model
 * Defines the user schema for the application
 * 
 * 
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ethers } = require('ethers');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email'
      ]
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false // Don't return password in queries by default
    },
    phoneNumber: {
      type: String,
      match: [
        /^\+[1-9]\d{1,14}$/, 
        'Phone number must be in E.164 format (e.g., +254712345678)'
      ]
    },
    walletAddress: {
      type: String,
      unique: true,
      sparse: true,
      validate: {
        validator: function(value) {
          return value === null || value === undefined || value === '' || ethers.isAddress(value);
        },
        message: 'Invalid Ethereum wallet address'
      }
    },
    rewardPoints: {
      type: Number,
      default: 0
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    phoneVerified: {
      type: Boolean,
      default: false
    },
    phoneVerificationCode: String,
    phoneVerificationExpire: Date,
    preferences: {
      currency: {
        type: String,
        enum: ['USD', 'KES', 'ETH', 'USDC'],
        default: 'USDC'
      },
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system'
      },
      language: {
        type: String,
        default: 'en'
      }
    },
    lastSyncedWithBlockchain: {
      type: Date
    },
    metadata: {
      registrationSource: {
        type: String,
        enum: ['web', 'mobile', 'social'],
        default: 'web'
      },
      userAgent: String,
      ipAddress: String
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for user's goals (not stored in DB)
UserSchema.virtual('goals', {
  ref: 'Goal',
  localField: '_id',
  foreignField: 'userId',
  justOne: false
});

// Virtual for user's challenges (not stored in DB)
UserSchema.virtual('challenges', {
  ref: 'Challenge',
  localField: '_id',
  foreignField: 'participants.userId',
  justOne: false
});

// Virtual for user's transactions (not stored in DB)
UserSchema.virtual('transactions', {
  ref: 'Transaction',
  localField: '_id',
  foreignField: 'userId',
  justOne: false
});

// Create indexes
UserSchema.index({ resetPasswordToken: 1 }, { sparse: true });

// Encrypt password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate email verification token
UserSchema.methods.generateEmailVerificationToken = function() {
  // Generate token
  const verificationToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to emailVerificationToken field
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  // Set expire (24 hours)
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
  
  return verificationToken;
};

// Generate password reset token
UserSchema.methods.generatePasswordResetToken = function() {
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Set expire (1 hour)
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000;
  
  return resetToken;
};

// Generate phone verification code
UserSchema.methods.generatePhoneVerificationCode = function() {
  // Generate 6-digit code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store code
  this.phoneVerificationCode = verificationCode;
  
  // Set expire (15 minutes)
  this.phoneVerificationExpire = Date.now() + 15 * 60 * 1000;
  
  return verificationCode;
};

// Calculate total savings (function can be optimized with caching)
UserSchema.methods.getTotalSavings = async function() {
  const mongoose = require('mongoose');
  const Transaction = mongoose.model('Transaction');
  
  const deposits = await Transaction.aggregate([
    {
      $match: {
        userId: this._id,
        type: 'deposit',
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);
  
  const withdrawals = await Transaction.aggregate([
    {
      $match: {
        userId: this._id,
        type: 'withdrawal',
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);
  
  const totalDeposits = deposits.length > 0 ? deposits[0].total : 0;
  const totalWithdrawals = withdrawals.length > 0 ? withdrawals[0].total : 0;
  
  return totalDeposits - totalWithdrawals;
};

// Update last login time
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = Date.now();
  return this.save();
};

module.exports = mongoose.model('User', UserSchema);