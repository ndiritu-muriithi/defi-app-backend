/**
 * Validation Utilities
 * Common validation functions used throughout the application
 * 
 * 
 */

const { ethers } = require('ethers');
const { validationResult } = require('express-validator');

/**
 * Extract and format validation errors from express-validator
 * @param {Object} req - Express request object
 * @returns {Object|null} Object with formatted errors or null if no errors
 */
const formatValidationErrors = (req) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return null;
  }
  
  // Format errors in a more user-friendly structure
  const formattedErrors = {};
  errors.array().forEach((error) => {
    formattedErrors[error.param] = error.msg;
  });
  
  return formattedErrors;
};

/**
 * Validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ObjectId
 */
const isValidObjectId = (id) => {
  if (!id) return false;
  
  // Regular expression for checking MongoDB ObjectId
  const objectIdPattern = /^[0-9a-fA-F]{24}$/;
  return objectIdPattern.test(id);
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
const isValidEmail = (email) => {
  if (!email) return false;
  
  const emailPattern = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailPattern.test(email);
};

/**
 * Validate phone number in E.164 format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {boolean} True if valid phone number
 */
const isValidPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return false;
  
  // E.164 format: +[country code][number]
  const phonePattern = /^\+[1-9]\d{1,14}$/;
  return phonePattern.test(phoneNumber);
};

/**
 * Validate Ethereum wallet address
 * @param {string} address - Wallet address to validate
 * @returns {boolean} True if valid Ethereum address
 */
const isValidEthereumAddress = (address) => {
  if (!address) return false;
  
  return ethers.isAddress(address);
};

/**
 * Validate amount is a positive number
 * @param {number|string} amount - Amount to validate
 * @returns {boolean} True if valid amount
 */
const isValidAmount = (amount) => {
  if (amount === undefined || amount === null) return false;
  
  const numAmount = Number(amount);
  return !isNaN(numAmount) && numAmount > 0;
};

/**
 * Validate date is in the future
 * @param {Date|string} date - Date to validate
 * @returns {boolean} True if valid future date
 */
const isFutureDate = (date) => {
  if (!date) return false;
  
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return false;
  
  const now = new Date();
  return dateObj > now;
};

/**
 * Validate date is in the past
 * @param {Date|string} date - Date to validate
 * @returns {boolean} True if valid past date
 */
const isPastDate = (date) => {
  if (!date) return false;
  
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return false;
  
  const now = new Date();
  return dateObj < now;
};

/**
 * Validate strong password
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with success and message
 */
const validatePassword = (password) => {
  if (!password) {
    return { success: false, message: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters long' };
  }
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password);
  
  if (!hasUpperCase) {
    return { success: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!hasLowerCase) {
    return { success: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!hasNumbers) {
    return { success: false, message: 'Password must contain at least one number' };
  }
  
  if (!hasSpecialChars) {
    return { success: false, message: 'Password must contain at least one special character' };
  }
  
  return { success: true, message: 'Password is strong' };
};

/**
 * Validate name (no special characters or numbers)
 * @param {string} name - Name to validate
 * @returns {boolean} True if valid name
 */
const isValidName = (name) => {
  if (!name) return false;
  
  const namePattern = /^[a-zA-Z\s-']+$/;
  return namePattern.test(name);
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
const isValidUrl = (url) => {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validate Ethereum transaction hash
 * @param {string} txHash - Transaction hash to validate
 * @returns {boolean} True if valid tx hash
 */
const isValidTxHash = (txHash) => {
  if (!txHash) return false;
  
  const txHashPattern = /^0x([A-Fa-f0-9]{64})$/;
  return txHashPattern.test(txHash);
};

/**
 * Validate goal category
 * @param {string} category - Category to validate
 * @returns {boolean} True if valid category
 */
const isValidGoalCategory = (category) => {
  if (!category) return false;
  
  const validCategories = [
    'land', 'business', 'education', 'emergency', 
    'retirement', 'travel', 'vehicle', 'home', 
    'family', 'health', 'debt', 'crypto', 'other'
  ];
  
  return validCategories.includes(category);
};

/**
 * Validate goal priority
 * @param {string} priority - Priority to validate
 * @returns {boolean} True if valid priority
 */
const isValidPriority = (priority) => {
  if (!priority) return false;
  
  const validPriorities = ['high', 'medium', 'low'];
  return validPriorities.includes(priority);
};

/**
 * Validate goal status
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid status
 */
const isValidGoalStatus = (status) => {
  if (!status) return false;
  
  const validStatuses = ['active', 'completed', 'cancelled', 'paused'];
  return validStatuses.includes(status);
};

/**
 * Validate reminder frequency
 * @param {string} frequency - Frequency to validate
 * @returns {boolean} True if valid frequency
 */
const isValidReminderFrequency = (frequency) => {
  if (!frequency) return false;
  
  const validFrequencies = ['daily', 'weekly', 'monthly', 'none'];
  return validFrequencies.includes(frequency);
};

/**
 * Validate day of week
 * @param {number} day - Day to validate (0-6, where 0 is Sunday)
 * @returns {boolean} True if valid day of week
 */
const isValidDayOfWeek = (day) => {
  if (day === undefined || day === null) return false;
  
  const numDay = Number(day);
  return !isNaN(numDay) && numDay >= 0 && numDay <= 6;
};

/**
 * Validate image file type
 * @param {string} mimeType - MIME type to validate
 * @returns {boolean} True if valid image file
 */
const isValidImageType = (mimeType) => {
  if (!mimeType) return false;
  
  const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return validImageTypes.includes(mimeType);
};

/**
 * Validate document file type
 * @param {string} mimeType - MIME type to validate
 * @returns {boolean} True if valid document file
 */
const isValidDocumentType = (mimeType) => {
  if (!mimeType) return false;
  
  const validDocTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
  return validDocTypes.includes(mimeType);
};

/**
 * Validate file size
 * @param {number} fileSize - File size in bytes
 * @param {number} maxSize - Maximum allowed size in bytes
 * @returns {boolean} True if file size is within limits
 */
const isValidFileSize = (fileSize, maxSize = 5 * 1024 * 1024) => {
  if (fileSize === undefined || fileSize === null) return false;
  
  return fileSize > 0 && fileSize <= maxSize;
};

module.exports = {
  formatValidationErrors,
  isValidObjectId,
  isValidEmail,
  isValidPhoneNumber,
  isValidEthereumAddress,
  isValidAmount,
  isFutureDate,
  isPastDate,
  validatePassword,
  isValidName,
  isValidUrl,
  isValidTxHash,
  isValidGoalCategory,
  isValidPriority,
  isValidGoalStatus,
  isValidReminderFrequency,
  isValidDayOfWeek,
  isValidImageType,
  isValidDocumentType,
  isValidFileSize
};