const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalcontroller');
const { auth } = require('../middleware/auth');
const { standard } = require('../middleware/ratelimiter');

// Create new goal
router.post('/', auth, standard, goalController.createGoal);

// Get all user goals
router.get('/', auth, goalController.getGoals);

// Get single goal by ID
router.get('/:id', auth, goalController.getGoalById);

// Update goal
router.put('/:id', auth, goalController.updateGoal);

// Delete goal
router.delete('/:id', auth, goalController.deleteGoal);

// Contribute to a goal
router.post('/:id/contribute', auth, standard, goalController.contributeToGoal);

module.exports = router; 