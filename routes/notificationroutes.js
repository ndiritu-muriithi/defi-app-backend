/**
 * Notification Routes
 * Routes for notification management
 * 
 * 
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');
const admin = require('../middleware/admin');
const { standard, sms } = require('../middleware/ratelimiter');

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications with optional pagination and filters
 * @access  Private
 */
router.get('/', auth, standard, notificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 */
router.get('/unread-count', auth, standard, notificationController.getUnreadCount);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.patch('/:id/read', auth, standard, notificationController.markAsRead);

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/read-all', auth, standard, notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', auth, standard, notificationController.deleteNotification);

/**
 * @route   DELETE /api/notifications
 * @desc    Delete all notifications
 * @access  Private
 */
router.delete('/', auth, standard, notificationController.deleteAllNotifications);

/**
 * @route   GET /api/notifications/settings
 * @desc    Get notification settings
 * @access  Private
 */
router.get('/settings', auth, standard, notificationController.getNotificationSettings);

/**
 * @route   PUT /api/notifications/settings
 * @desc    Update notification settings
 * @access  Private
 */
router.put('/settings', auth, standard, notificationController.updateNotificationSettings);

/**
 * @route   POST /api/notifications/test-sms
 * @desc    Send test SMS notification
 * @access  Private
 */
router.post('/test-sms', auth, sms, notificationController.sendTestSms);

/**
 * @route   POST /api/notifications/system
 * @desc    Create system notification
 * @access  Admin
 */
router.post('/system', auth, admin, standard, notificationController.createSystemNotification);

module.exports = router;