/**
 * Notification Setting Model
 * Manages user notification preferences
 */

const mongoose = require('mongoose');

const notificationSettingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    unique: true
  },
  smsEnabled: {
    type: Boolean,
    default: true
  },
  emailEnabled: {
    type: Boolean,
    default: true
  },
  pushEnabled: {
    type: Boolean,
    default: true
  },
  goalReminders: {
    type: Boolean,
    default: true
  },
  depositNotifications: {
    type: Boolean,
    default: true
  },
  withdrawalNotifications: {
    type: Boolean,
    default: true
  },
  challengeNotifications: {
    type: Boolean,
    default: true
  },
  weeklySummary: {
    type: Boolean,
    default: true
  },
  marketingEmails: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
notificationSettingSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('NotificationSetting', notificationSettingSchema); 