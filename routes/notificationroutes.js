/**
 * Notification Routes
 * Routes for notification management
 * 
 * 
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { standard: rateLimiter } = require('../middleware/ratelimiter');

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications with optional pagination and filters
 * @access  Private
 */
router.get('/', auth, notificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get('/unread-count', auth, notificationController.getUnreadCount);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put('/:id/read', auth, notificationController.markAsRead);

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/mark-all-read', auth, notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', auth, notificationController.deleteNotification);

/**
 * @route   DELETE /api/notifications
 * @desc    Delete all notifications
 * @access  Private
 */
router.delete('/', auth, notificationController.deleteAllNotifications);

/**
 * @route   GET /api/notifications/settings
 * @desc    Get notification settings
 * @access  Private
 */
router.get('/settings', auth, notificationController.getNotificationSettings);

/**
 * @route   PUT /api/notifications/settings
 * @desc    Update notification settings
 * @access  Private
 */
router.put('/settings', auth, notificationController.updateNotificationSettings);

/**
 * @route   POST /api/notifications/test-sms
 * @desc    Send test SMS notification
 * @access  Private
 * @note    Rate limited to prevent abuse
 */
router.post('/test-sms', auth, rateLimiter, notificationController.sendTestSms);

/**
 * @route   POST /api/notifications/system
 * @desc    Create system notification for user(s)
 * @access  Admin
 * @note    Only accessible to admin users
 */
router.post('/system', [auth, admin], notificationController.createSystemNotification);

module.exports = router;