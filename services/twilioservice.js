/**
 * Twilio Service
 * Handles SMS notifications and reminders via Twilio API
 * 
 * 
 */

const twilio = require('twilio');
const redis = require('../config/redis');
const User = require('../models/user');
const NotificationSetting = require('../models/notificationsetting');
require('dotenv').config();

// Environment variables
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Check if Twilio credentials are valid
const isTwilioConfigured = () => {
  return TWILIO_ACCOUNT_SID && 
         TWILIO_ACCOUNT_SID.startsWith('AC') && 
         TWILIO_AUTH_TOKEN && 
         TWILIO_PHONE_NUMBER;
};

// Create Twilio client only if credentials are valid
let client;
if (isTwilioConfigured()) {
  client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
} else {
  console.warn('Twilio credentials not configured. SMS notifications will be disabled.');
}

// Rate limiting settings
const RATE_LIMIT = {
  MAX_SMS_PER_USER_PER_DAY: 5,
  SMS_RATE_LIMIT_TTL: 24 * 60 * 60 // 24 hours in seconds
};

// Message templates
const MESSAGE_TEMPLATES = {
  WELCOME: (name) => `Welcome to BazuuSave, ${name}! Your account has been created successfully. Start saving towards your financial goals today.`,
  
  DEPOSIT_CONFIRMATION: (amount) => `Your deposit of ${amount} USDC has been confirmed. Thank you for saving with BazuuSave!`,
  
  WITHDRAWAL_CONFIRMATION: (amount) => `Your withdrawal of ${amount} USDC has been processed. Thank you for using BazuuSave!`,
  
  GOAL_CREATION: (goalName, targetAmount) => `New goal created: "${goalName}" with a target of ${targetAmount} USDC. Start saving today!`,
  
  GOAL_COMPLETION: (goalName) => `Congratulations! You've completed your goal "${goalName}". Keep up the great saving habits!`,
  
  GOAL_REMINDER: (goalName, currentAmount, targetAmount, daysLeft) => 
    `Reminder: Your goal "${goalName}" has ${daysLeft} days left. Currently saved: ${currentAmount}/${targetAmount} USDC.`,
  
  CHALLENGE_JOIN: (challengeName) => `You've joined the "${challengeName}" savings challenge. Good luck achieving your target!`,
  
  CHALLENGE_COMPLETION: (challengeName, rewardPoints) => 
    `Congratulations! You've completed the "${challengeName}" challenge and earned ${rewardPoints} reward points!`,
  
  VERIFY_PHONE: (code) => `Your BazuuSave verification code is: ${code}. It will expire in 15 minutes.`,
  
  PASSWORD_RESET: (token) => `Your BazuuSave password reset token is: ${token}. It will expire in 1 hour.`,
  
  WEEKLY_SUMMARY: (totalSaved, goalsCount) => 
    `Your weekly BazuuSave summary: Total saved this week: ${totalSaved} USDC. Active goals: ${goalsCount}.`
};

/**
 * Check if user has exceeded SMS rate limit
 * @param {string} userId User ID
 * @returns {Promise<boolean>} True if rate limit exceeded
 */
const checkRateLimit = async (userId) => {
  try {
    const key = `sms_count:${userId}`;
    const count = await redis.getCache(key);
    
    if (count === null) {
      // No count yet, set to 1
      await redis.setCache(key, '1', RATE_LIMIT.SMS_RATE_LIMIT_TTL);
      return false;
    }
    
    const smsCount = parseInt(count, 10);
    if (smsCount >= RATE_LIMIT.MAX_SMS_PER_USER_PER_DAY) {
      return true;
    }
    
    // Increment count
    await redis.setCache(key, (smsCount + 1).toString(), RATE_LIMIT.SMS_RATE_LIMIT_TTL);
    return false;
  } catch (error) {
    console.error('Error checking SMS rate limit:', error);
    // If we can't check the rate limit, assume it's not exceeded
    return false;
  }
};

/**
 * Sanitize phone number to E.164 format
 * @param {string} phoneNumber Phone number to sanitize
 * @returns {string} Sanitized phone number
 */
const sanitizePhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters
  let digits = phoneNumber.replace(/\D/g, '');
  
  // Check if the number already has a '+' prefix
  if (phoneNumber.startsWith('+')) {
    return '+' + digits;
  }
  
  // If it starts with a country code (like 254 for Kenya), add '+'
  if (digits.startsWith('254')) {
    return '+' + digits;
  }
  
  // If it's a Kenyan number starting with 0, replace 0 with +254
  if (digits.startsWith('0') && digits.length === 10) {
    return '+254' + digits.substring(1);
  }
  
  // If it's a Kenyan number without the leading 0, add +254
  if (digits.length === 9 && !digits.startsWith('0')) {
    return '+254' + digits;
  }
  
  // If we can't determine the format, return as is with '+'
  return '+' + digits;
};

/**
 * Send SMS via Twilio
 * @param {string} to Recipient phone number
 * @param {string} message Message to send
 * @returns {Promise<object>} Twilio response
 */
const sendSMS = async (to, message) => {
  try {
    // Check if Twilio is configured
    if (!isTwilioConfigured()) {
      console.log(`[SMS] Would send to ${to}: ${message}`);
      return {
        success: true,
        sid: 'MOCK_SID',
        to,
        status: 'queued',
        mock: true
      };
    }

    // Sanitize phone number
    const sanitizedPhone = sanitizePhoneNumber(to);
    
    // Send SMS
    const response = await client.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: sanitizedPhone
    });
    
    console.log(`SMS sent to ${sanitizedPhone}, SID: ${response.sid}`);
    
    return {
      success: true,
      sid: response.sid,
      to: sanitizedPhone,
      status: response.status
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send SMS to user by user ID
 * @param {string} userId User ID
 * @param {string} message Message to send
 * @returns {Promise<object>} Response object
 */
const sendSMSToUser = async (userId, message) => {
  try {
    // Check if user has exceeded rate limit
    const isRateLimited = await checkRateLimit(userId);
    if (isRateLimited) {
      return {
        success: false,
        error: 'Rate limit exceeded for SMS notifications',
        rateLimited: true
      };
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user || !user.phoneNumber) {
      return {
        success: false,
        error: 'User not found or no phone number available'
      };
    }
    
    // Check notification settings
    const settings = await NotificationSetting.findOne({ user: userId });
    if (settings && !settings.smsEnabled) {
      return {
        success: false,
        error: 'SMS notifications disabled for user',
        disabled: true
      };
    }
    
    // Send SMS
    return await sendSMS(user.phoneNumber, message);
  } catch (error) {
    console.error('Error sending SMS to user:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send welcome message to new user
 * @param {string} userId User ID
 * @returns {Promise<object>} Response object
 */
const sendWelcomeMessage = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }
    
    const message = MESSAGE_TEMPLATES.WELCOME(user.name);
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending welcome message:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send deposit confirmation
 * @param {string} userId User ID
 * @param {number} amount Deposit amount
 * @returns {Promise<object>} Response object
 */
const sendDepositConfirmation = async (userId, amount) => {
  try {
    const message = MESSAGE_TEMPLATES.DEPOSIT_CONFIRMATION(amount);
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending deposit confirmation:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send withdrawal confirmation
 * @param {string} userId User ID
 * @param {number} amount Withdrawal amount
 * @returns {Promise<object>} Response object
 */
const sendWithdrawalConfirmation = async (userId, amount) => {
  try {
    const message = MESSAGE_TEMPLATES.WITHDRAWAL_CONFIRMATION(amount);
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending withdrawal confirmation:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send goal creation notification
 * @param {string} userId User ID
 * @param {object} goal Goal object
 * @returns {Promise<object>} Response object
 */
const sendGoalCreationNotification = async (userId, goal) => {
  try {
    const message = MESSAGE_TEMPLATES.GOAL_CREATION(goal.name, goal.targetAmount);
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending goal creation notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send goal completion notification
 * @param {string} userId User ID
 * @param {object} goal Goal object
 * @returns {Promise<object>} Response object
 */
const sendGoalCompletionNotification = async (userId, goal) => {
  try {
    const message = MESSAGE_TEMPLATES.GOAL_COMPLETION(goal.name);
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending goal completion notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send goal reminder
 * @param {string} userId User ID
 * @param {object} goal Goal object
 * @returns {Promise<object>} Response object
 */
const sendGoalReminder = async (userId, goal) => {
  try {
    const daysLeft = goal.daysRemaining;
    const message = MESSAGE_TEMPLATES.GOAL_REMINDER(
      goal.name,
      goal.currentAmount,
      goal.targetAmount,
      daysLeft
    );
    
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending goal reminder:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Schedule a goal reminder
 * @param {string} userId User ID
 * @param {string} goalId Goal ID
 * @returns {Promise<object>} Response object
 */
const scheduleGoalReminder = async (userId, goalId) => {
  // This is a placeholder for integration with a queueing system
  // In a real implementation, this would add a job to a queue like Bull
  console.log(`Scheduled reminder for goal ${goalId} for user ${userId}`);
  
  return {
    success: true,
    message: 'Reminder scheduled',
    userId,
    goalId
  };
};

/**
 * Send challenge join notification
 * @param {string} userId User ID
 * @param {object} challenge Challenge object
 * @returns {Promise<object>} Response object
 */
const sendChallengeJoinNotification = async (userId, challenge) => {
  try {
    const message = MESSAGE_TEMPLATES.CHALLENGE_JOIN(challenge.name);
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending challenge join notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send challenge completion notification
 * @param {string} userId User ID
 * @param {object} challenge Challenge object
 * @returns {Promise<object>} Response object
 */
const sendChallengeCompletionNotification = async (userId, challenge) => {
  try {
    const message = MESSAGE_TEMPLATES.CHALLENGE_COMPLETION(
      challenge.name,
      challenge.rewardPoints
    );
    
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending challenge completion notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send phone verification code
 * @param {string} userId User ID
 * @param {string} code Verification code
 * @returns {Promise<object>} Response object
 */
const sendPhoneVerificationCode = async (userId, code) => {
  try {
    const message = MESSAGE_TEMPLATES.VERIFY_PHONE(code);
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending phone verification code:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send password reset token
 * @param {string} userId User ID
 * @param {string} token Reset token
 * @returns {Promise<object>} Response object
 */
const sendPasswordResetToken = async (userId, token) => {
  try {
    const message = MESSAGE_TEMPLATES.PASSWORD_RESET(token);
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending password reset token:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send weekly summary
 * @param {string} userId User ID
 * @param {number} totalSaved Total amount saved
 * @param {number} goalsCount Number of active goals
 * @returns {Promise<object>} Response object
 */
const sendWeeklySummary = async (userId, totalSaved, goalsCount) => {
  try {
    const message = MESSAGE_TEMPLATES.WEEKLY_SUMMARY(totalSaved, goalsCount);
    return await sendSMSToUser(userId, message);
  } catch (error) {
    console.error('Error sending weekly summary:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check Twilio service health
 * @returns {Promise<object>} Health status
 */
const getServiceHealth = async () => {
  try {
    // Check if Twilio credentials are configured
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return {
        status: 'misconfigured',
        message: 'Twilio credentials not fully configured',
        timestamp: new Date().toISOString()
      };
    }
    
    // Check if we can fetch account info
    const account = await client.api.accounts(TWILIO_ACCOUNT_SID).fetch();
    
    return {
      status: 'connected',
      accountStatus: account.status,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Twilio health check failed:', error);
    return {
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  sendSMS,
  sendSMSToUser,
  sendWelcomeMessage,
  sendDepositConfirmation,
  sendWithdrawalConfirmation,
  sendGoalCreationNotification,
  sendGoalCompletionNotification,
  sendGoalReminder,
  scheduleGoalReminder,
  sendChallengeJoinNotification,
  sendChallengeCompletionNotification,
  sendPhoneVerificationCode,
  sendPasswordResetToken,
  sendWeeklySummary,
  getServiceHealth,
  MESSAGE_TEMPLATES
};