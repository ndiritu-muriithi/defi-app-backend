/**
 * Notification Controller
 * Handles notifications via SMS, in-app messages, and reminders
 * 
 */

const notification = require('../models/notification');
const user = require('../models/user');
const notificationSetting = require('../models/notificationSetting');
const twilioservice = require('../services/twilioservice');
const redis = require('../config/redis');
const { scheduleNotification } = require('../services/notificationqueue');
require('dotenv').config();

/**
 * Get all notifications for the current user
 * @route GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    // Get total count (using countDocuments for filtered queries)
    const total = await Notification.countDocuments({ user: req.user.id });
    
    // Get notifications for user with pagination
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);
    
    // Mark retrieved notifications as read if requested
    if (req.query.markAsRead === 'true') {
      const notificationIds = notifications
        .filter(notification => !notification.isRead)
        .map(notification => notification._id);
      
      if (notificationIds.length > 0) {
        await Notification.updateMany(
          { _id: { $in: notificationIds } },
          { isRead: true }
        );
        
        // Update read status in returned objects
        notifications.forEach(notification => {
          if (!notification.isRead) {
            notification.isRead = true;
          }
        });
      }
    }
    
    // Calculate pagination info
    const pagination = {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
    
    res.status(200).json({
      success: true,
      count: notifications.length,
      pagination,
      data: notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving notifications'
    });
  }
};

/**
 * Get unread notification count
 * @route GET /api/notifications/unread-count
 */
exports.getUnreadCount = async (req, res) => {
  try {
    // Try to get from cache first
    const cacheKey = `unread_count:${req.user.id}`;
    let count = await redis.getCache(cacheKey);
    
    if (count === null) {
      // Not in cache, get from database
      count = await Notification.countDocuments({
        user: req.user.id,
        isRead: false
      });
      
      // Cache for 5 minutes
      await redis.setCache(cacheKey, count.toString(), 300);
    } else {
      count = parseInt(count, 10);
    }
    
    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting unread notification count'
    });
  }
};

/**
 * Mark notification as read
 * @route PUT /api/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    // Only update if not already read
    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
      
      // Invalidate unread count cache
      await redis.deleteCache(`unread_count:${req.user.id}`);
    }
    
    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error marking notification as read'
    });
  }
};

/**
 * Mark all notifications as read
 * @route PUT /api/notifications/mark-all-read
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { isRead: true }
    );
    
    // Invalidate unread count cache
    await redis.deleteCache(`unread_count:${req.user.id}`);
    
    res.status(200).json({
      success: true,
      count: result.modifiedCount,
      message: `${result.modifiedCount} notifications marked as read`
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error marking all notifications as read'
    });
  }
};

/**
 * Delete a notification
 * @route DELETE /api/notifications/:id
 */
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user.id
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    await notification.remove();
    
    // If deleting an unread notification, invalidate unread count cache
    if (!notification.isRead) {
      await redis.deleteCache(`unread_count:${req.user.id}`);
    }
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error deleting notification'
    });
  }
};

/**
 * Delete all notifications
 * @route DELETE /api/notifications
 */
exports.deleteAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ user: req.user.id });
    
    // Invalidate unread count cache
    await redis.deleteCache(`unread_count:${req.user.id}`);
    
    res.status(200).json({
      success: true,
      count: result.deletedCount,
      message: `${result.deletedCount} notifications deleted`
    });
  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error deleting all notifications'
    });
  }
};

/**
 * Get notification settings
 * @route GET /api/notifications/settings
 */
exports.getNotificationSettings = async (req, res) => {
  try {
    let settings = await NotificationSetting.findOne({ user: req.user.id });
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await NotificationSetting.create({
        user: req.user.id,
        smsEnabled: true,
        inAppEnabled: true,
        goalReminders: true,
        depositConfirmations: true,
        withdrawalConfirmations: true,
        challengeUpdates: true,
        weeklyReports: true
      });
    }
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error getting notification settings'
    });
  }
};

/**
 * Update notification settings
 * @route PUT /api/notifications/settings
 */
exports.updateNotificationSettings = async (req, res) => {
  try {
    const allowedFields = [
      'smsEnabled',
      'inAppEnabled',
      'goalReminders',
      'depositConfirmations',
      'withdrawalConfirmations',
      'challengeUpdates',
      'weeklyReports'
    ];
    
    // Filter to only allowed fields
    const updateData = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });
    
    // Update or create settings
    let settings = await NotificationSetting.findOneAndUpdate(
      { user: req.user.id },
      updateData,
      { new: true, upsert: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating notification settings'
    });
  }
};

/**
 * Send test SMS notification
 * @route POST /api/notifications/test-sms
 */
exports.sendTestSms = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'User does not have a phone number set'
      });
    }
    
    // Send test SMS
    await twilioService.sendSMS(
      user.phoneNumber,
      'This is a test message from BazuuSave. Your notifications are working!'
    );
    
    // Create notification record
    await Notification.create({
      user: req.user.id,
      title: 'Test Notification',
      message: 'Test SMS notification sent successfully',
      type: 'test',
      isRead: false
    });
    
    // Invalidate unread count cache
    await redis.deleteCache(`unread_count:${req.user.id}`);
    
    res.status(200).json({
      success: true,
      message: 'Test SMS sent successfully'
    });
  } catch (error) {
    console.error('Send test SMS error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error sending test SMS'
    });
  }
};

/**
 * Create system notification for user(s)
 * @route POST /api/notifications/system
 * @access Private/Admin
 */
exports.createSystemNotification = async (req, res) => {
  try {
    const { title, message, users, sendSms, notificationType } = req.body;
    
    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Title and message are required'
      });
    }
    
    // Determine target users
    let targetUsers = [];
    if (users && users.length > 0) {
      // Send to specific users
      targetUsers = users;
    } else {
      // Send to all users
      const allUsers = await User.find({}, '_id');
      targetUsers = allUsers.map(user => user._id);
    }
    
    // Create notifications
    const notifications = targetUsers.map(userId => ({
      user: userId,
      title,
      message,
      type: notificationType || 'system',
      isRead: false
    }));
    
    await Notification.insertMany(notifications);
    
    // Invalidate unread count cache for all affected users
    const cacheDeletePromises = targetUsers.map(userId => 
      redis.deleteCache(`unread_count:${userId}`)
    );
    await Promise.all(cacheDeletePromises);
    
    // Send SMS if requested
    if (sendSms) {
      // Get users with phone numbers
      const usersWithPhones = await User.find(
        { _id: { $in: targetUsers }, phoneNumber: { $exists: true, $ne: '' } },
        '_id phoneNumber'
      );
      
      // Send SMS to each user
      const smsPromises = usersWithPhones.map(user => 
        scheduleNotification.sms(user._id, message, user.phoneNumber)
      );
      await Promise.all(smsPromises);
    }
    
    res.status(201).json({
      success: true,
      count: targetUsers.length,
      message: `System notification sent to ${targetUsers.length} users`
    });
  } catch (error) {
    console.error('Create system notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error creating system notification'
    });
  }
};

/**
 * Create notification
 * @private - internal use only
 */
exports.createNotification = async (userId, title, message, type = 'general', data = null) => {
  try {
    // Create notification in database
    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type,
      data,
      isRead: false
    });
    
    // Invalidate unread count cache
    await redis.deleteCache(`unread_count:${userId}`);
    
    return notification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

/**
 * Send SMS notification
 * @private - internal use only
 */
exports.sendSmsNotification = async (userId, message) => {
  try {
    // Get user
    const user = await User.findById(userId);
    
    if (!user || !user.phoneNumber) {
      throw new Error('User not found or no phone number available');
    }
    
    // Check user's notification settings
    const settings = await NotificationSetting.findOne({ user: userId });
    
    if (!settings || !settings.smsEnabled) {
      return { success: false, reason: 'SMS notifications disabled for user' };
    }
    
    // Add to notification queue
    await scheduleNotification.sms(userId, message, user.phoneNumber);
    
    return { success: true };
  } catch (error) {
    console.error('Send SMS notification error:', error);
    throw error;
  }
};

/**
 * Schedule goal reminder
 * @private - internal use only
 */
exports.scheduleGoalReminder = async (userId, goalId) => {
  try {
    // Check user's notification settings
    const settings = await NotificationSetting.findOne({ user: userId });
    
    if (!settings || !settings.goalReminders) {
      return { success: false, reason: 'Goal reminders disabled for user' };
    }
    
    // Schedule reminder in queue
    const job = await scheduleNotification.goalReminder(goalId, {
      repeat: {
        cron: '0 10 * * 1' // Every Monday at 10 AM
      }
    });
    
    return { success: true, jobId: job.id };
  } catch (error) {
    console.error('Schedule goal reminder error:', error);
    throw error;
  }
};