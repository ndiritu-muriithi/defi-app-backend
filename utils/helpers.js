/**
 * Helper Utilities
 * Common helper functions used throughout the application
 * 
 *
 */

const crypto = require('crypto');
const { ethers } = require('ethers');

/**
 * Generate a random token
 * @param {number} bytes - Number of bytes for the token (default: 32)
 * @returns {string} Random hex token
 */
const generateToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Generate a random numeric code
 * @param {number} length - Length of the code (default: 6)
 * @returns {string} Random numeric code
 */
const generateNumericCode = (length = 6) => {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

/**
 * Hash a string using SHA-256
 * @param {string} data - Data to hash
 * @returns {string} Hashed string
 */
const hashString = (data) => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'USDC')
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted currency string
 */
const formatCurrency = (amount, currency = 'USDC', locale = 'en-US') => {
  if (isNaN(amount)) return '0.00 ' + currency;
  
  if (currency === 'USDC' || currency === 'ETH') {
    // For crypto, always show at least 2 decimals, max 6
    return parseFloat(amount).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }) + ' ' + currency;
  } else {
    // For fiat currencies, use built-in formatter
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency
    }).format(amount);
  }
};

/**
 * Format percentage for display
 * @param {number} value - Value to format as percentage
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted percentage string
 */
const formatPercentage = (value, decimals = 2) => {
  if (isNaN(value)) return '0%';
  
  return parseFloat(value).toFixed(decimals) + '%';
};

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - Format style (default: 'medium')
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted date string
 */
const formatDate = (date, format = 'medium', locale = 'en-US') => {
  if (!date) return '';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  const options = {
    short: { year: 'numeric', month: 'numeric', day: 'numeric' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' },
    time: { hour: '2-digit', minute: '2-digit' },
    datetime: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  };
  
  return dateObj.toLocaleString(locale, options[format] || options.medium);
};

/**
 * Calculate time difference in human-readable format
 * @param {Date|string} date - Date to compare with now
 * @returns {string} Human-readable time difference
 */
const timeAgo = (date) => {
  if (!date) return '';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now - dateObj) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} ${diffInSeconds === 1 ? 'second' : 'seconds'} ago`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
};

/**
 * Calculate time until a date in human-readable format
 * @param {Date|string} date - Date to calculate time until
 * @returns {string} Human-readable time until
 */
const timeUntil = (date) => {
  if (!date) return '';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return 'Invalid Date';
  
  const now = new Date();
  
  // If date is in the past, return "0 days"
  if (dateObj < now) {
    return '0 days';
  }
  
  const diffInSeconds = Math.floor((dateObj - now) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} ${diffInSeconds === 1 ? 'second' : 'seconds'}`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'}`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'}`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'}`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'}`;
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'}`;
};

/**
 * Truncate string to specified length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length (default: 50)
 * @returns {string} Truncated string
 */
const truncateString = (str, length = 50) => {
  if (!str) return '';
  
  if (str.length <= length) return str;
  
  return str.substring(0, length) + '...';
};

/**
 * Mask sensitive data (e.g., emails, phone numbers)
 * @param {string} data - Data to mask
 * @param {string} type - Type of data ('email', 'phone', 'wallet')
 * @returns {string} Masked data
 */
const maskSensitiveData = (data, type) => {
  if (!data) return '';
  
  switch (type) {
    case 'email':
      const [username, domain] = data.split('@');
      const maskedUsername = username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);
      return `${maskedUsername}@${domain}`;
      
    case 'phone':
      // Keep country code and last 4 digits
      return data.replace(/(\+\d{1,3})(\d{4,})(\d{4})/, '$1*****$3');
      
    case 'wallet':
      // Show first 6 and last 4 characters
      return data.substring(0, 6) + '...' + data.substring(data.length - 4);
      
    default:
      return data;
  }
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generate pagination metadata
 * @param {number} total - Total number of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
const generatePaginationMetadata = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null
  };
};

/**
 * Format blockchain address for display
 * @param {string} address - Ethereum address
 * @returns {string} Formatted address
 */
const formatAddress = (address) => {
  if (!address || !ethers.isAddress(address)) return '';
  
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

/**
 * Convert a number to USDC format (6 decimals)
 * @param {number|string} amount - Amount to convert
 * @returns {string} Amount in USDC format
 */
const toUSDCFormat = (amount) => {
  if (isNaN(amount)) return '0.000000';
  
  // USDC has 6 decimal places
  return parseFloat(amount).toFixed(6);
};

/**
 * Calculate average of an array of numbers
 * @param {Array<number>} values - Array of numbers
 * @returns {number} Average value
 */
const calculateAverage = (values) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  
  const sum = values.reduce((total, val) => total + (parseFloat(val) || 0), 0);
  return sum / values.length;
};

/**
 * Group an array of objects by a specific key
 * @param {Array<Object>} array - Array of objects
 * @param {string} key - Key to group by
 * @returns {Object} Grouped object
 */
const groupBy = (array, key) => {
  if (!Array.isArray(array)) return {};
  
  return array.reduce((result, item) => {
    const groupKey = item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
};

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Generate a random color
 * @returns {string} Random HEX color
 */
const generateRandomColor = () => {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
};

/**
 * Convert hex color to RGB
 * @param {string} hex - Hex color code
 * @returns {Object|null} RGB values or null if invalid
 */
const hexToRGB = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

/**
 * Generate a unique ID
 * @param {string} prefix - Prefix for the ID (default: 'id')
 * @returns {string} Unique ID
 */
const generateUniqueId = (prefix = 'id') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the specified time
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Promise that resolves with the function result
 */
const retry = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = baseDelay * Math.pow(2, i); // Exponential backoff
      console.log(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`);
      await sleep(delay);
    }
  }
  
  throw lastError;
};

/**
 * Sanitize a string for safe usage in queries
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (str) => {
  if (!str) return '';
  
  return str.replace(/[^\w\s.-]/g, '').trim();
};

module.exports = {
  generateToken,
  generateNumericCode,
  hashString,
  formatCurrency,
  formatPercentage,
  formatDate,
  timeAgo,
  timeUntil,
  truncateString,
  maskSensitiveData,
  formatFileSize,
  generatePaginationMetadata,
  formatAddress,
  toUSDCFormat,
  calculateAverage,
  groupBy,
  deepClone,
  generateRandomColor,
  hexToRGB,
  generateUniqueId,
  sleep,
  retry,
  sanitizeString
};