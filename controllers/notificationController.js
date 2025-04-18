const Notification = require('../models/notification');
const NotificationSetting = require('../models/notificationsetting');
const twilioService = require('../services/twilioservice');
const redis = require('../config/redis');

/**
 * Get user notifications
 * @route GET /api/notifications
 * @access Private
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, read } = req.query;
    
    // Build query
    const query = { userId };
    if (read !== undefined) {
      query.read = read === 'true';
    }
    
    // Get notifications with pagination
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    // Get total count
    const total = await Notification.countDocuments(query);
    
    res.status(200).json({
      success: true,
      notifications,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications'
    });
  }
};

/**
 * Get unread notifications count
 * @route GET /api/notifications/unread-count
 * @access Private
 */
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Try to get from cache first
    const cacheKey = `unread_count:${userId}`;
    const cachedCount = await redis.get(cacheKey);
    
    if (cachedCount) {
      return res.status(200).json({
        success: true,
        count: Number(cachedCount),
        fromCache: true
      });
    }
    
    // Get count from database
    const count = await Notification.countDocuments({
      userId,
      read: false
    });
    
    // Cache for 1 minute
    await redis.set(cacheKey, count.toString(), 'EX', 60);
    
    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
};

/**
 * Mark notification as read
 * @route PUT /api/notifications/:id/read
 * @access Private
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Find and update notification
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    // Invalidate cache
    await redis.del(`unread_count:${userId}`);
    
    res.status(200).json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
};

/**
 * Mark all notifications as read
 * @route PUT /api/notifications/mark-all-read
 * @access Private
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Update all notifications
    await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );
    
    // Invalidate cache
    await redis.del(`unread_count:${userId}`);
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
};

/**
 * Delete notification
 * @route DELETE /api/notifications/:id
 * @access Private
 */
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Find and delete notification
    const notification = await Notification.findOneAndDelete({
      _id: id,
      userId
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }
    
    // Invalidate cache
    await redis.del(`unread_count:${userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
};

/**
 * Delete all notifications
 * @route DELETE /api/notifications
 * @access Private
 */
exports.deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Delete all notifications
    await Notification.deleteMany({ userId });
    
    // Invalidate cache
    await redis.del(`unread_count:${userId}`);
    
    res.status(200).json({
      success: true,
      message: 'All notifications deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete all notifications'
    });
  }
};

/**
 * Get notification settings
 * @route GET /api/notifications/settings
 * @access Private
 */
exports.getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Try to get from cache first
    const cacheKey = `notification_settings:${userId}`;
    const cachedSettings = await redis.get(cacheKey);
    
    if (cachedSettings) {
      return res.status(200).json({
        success: true,
        settings: JSON.parse(cachedSettings),
        fromCache: true
      });
    }
    
    // Get settings from database
    let settings = await NotificationSetting.findOne({ userId });
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await NotificationSetting.create({
        userId,
        email: true,
        sms: true,
        push: true,
        goalReminders: true,
        depositAlerts: true,
        withdrawalAlerts: true,
        systemUpdates: true
      });
    }
    
    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(settings), 'EX', 300);
    
    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error getting notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification settings'
    });
  }
};

/**
 * Update notification settings
 * @route PUT /api/notifications/settings
 * @access Private
 */
exports.updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    
    // Update settings
    const settings = await NotificationSetting.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true }
    );
    
    // Invalidate cache
    await redis.del(`notification_settings:${userId}`);
    
    res.status(200).json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification settings'
    });
  }
};

/**
 * Send test SMS notification
 * @route POST /api/notifications/test-sms
 * @access Private
 */
exports.sendTestSms = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's phone number
    const user = await User.findById(userId);
    if (!user || !user.phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'User phone number not found'
      });
    }
    
    // Send test SMS
    await twilioService.sendSMS(
      user.phoneNumber,
      'This is a test SMS notification from BazuuSave.'
    );
    
    res.status(200).json({
      success: true,
      message: 'Test SMS sent successfully'
    });
  } catch (error) {
    console.error('Error sending test SMS:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test SMS'
    });
  }
};

/**
 * Create system notification
 * @route POST /api/notifications/system
 * @access Admin
 */
exports.createSystemNotification = async (req, res) => {
  try {
    const { userIds, title, message, type = 'info' } = req.body;
    
    // Create notifications for each user
    const notifications = await Promise.all(
      userIds.map(userId =>
        Notification.create({
          userId,
          title,
          message,
          type,
          isSystem: true
        })
      )
    );
    
    res.status(201).json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('Error creating system notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create system notification'
    });
  }
}; 