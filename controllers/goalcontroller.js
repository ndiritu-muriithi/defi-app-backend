const Goal = require('../models/goal');
const blockchainService = require('../services/blockchainservice');
const twilioService = require('../services/twilioservice');
const redis = require('../config/redis');

/**
 * Create a new goal
 * @route POST /api/goals
 * @access Private
 */
exports.createGoal = async (req, res) => {
  try {
    const { 
      name, 
      targetAmount, 
      durationInDays, 
      description, 
      type, 
      priority, 
      reminderFrequency, 
      privateKey 
    } = req.body;
    
    const userId = req.user.id;
    const walletAddress = req.user.walletAddress;
    
    // First create goal on blockchain
    const blockchainResult = await blockchainService.createGoal(
      privateKey,
      name,
      targetAmount,
      durationInDays
    );
    
    // Calculate start and end dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationInDays);
    
    // Create goal in database
    const goal = await Goal.create({
      userId,
      name,
      type: type || 'savings',
      targetAmount,
      currentAmount: 0,
      startDate,
      endDate,
      description,
      status: 'active',
      priority: priority || 'medium',
      reminderFrequency,
      blockchainId: blockchainResult.goalId,
      txHash: blockchainResult.txHash,
      walletAddress
    });
    
    // Send notification if user has phone number
    if (req.user.phoneNumber) {
      twilioService.sendSMS(
        req.user.phoneNumber,
        `You've created a new savings goal: "${name}" with a target of ${targetAmount} USDC.`
      );
    }
    
    res.status(201).json({
      success: true,
      goal
    });
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create goal'
    });
  }
};

/**
 * Get all goals for a user
 * @route GET /api/goals
 * @access Private
 */
exports.getGoals = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Try to get from cache first
    const cacheKey = `goals:${userId}`;
    const cachedGoals = await redis.get(cacheKey);
    
    if (cachedGoals) {
      return res.status(200).json({
        success: true,
        goals: JSON.parse(cachedGoals),
        fromCache: true
      });
    }
    
    // Get from database
    const goals = await Goal.find({ userId }).sort({ createdAt: -1 });
    
    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(goals), 'EX', 300);
    
    res.status(200).json({
      success: true,
      goals
    });
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch goals'
    });
  }
};

/**
 * Get a single goal by ID
 * @route GET /api/goals/:id
 * @access Private
 */
exports.getGoalById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Try to get from cache first
    const cacheKey = `goal:${id}`;
    const cachedGoal = await redis.get(cacheKey);
    
    if (cachedGoal) {
      const goal = JSON.parse(cachedGoal);
      if (goal.userId.toString() === userId.toString()) {
        return res.status(200).json({
          success: true,
          goal,
          fromCache: true
        });
      }
    }
    
    // Get from database
    const goal = await Goal.findOne({ _id: id, userId });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }
    
    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(goal), 'EX', 300);
    
    res.status(200).json({
      success: true,
      goal
    });
  } catch (error) {
    console.error('Error fetching goal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch goal'
    });
  }
};

/**
 * Update a goal
 * @route PUT /api/goals/:id
 * @access Private
 */
exports.updateGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // Find goal
    const goal = await Goal.findOne({ _id: id, userId });
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }

    // Update goal
    const updatedGoal = await Goal.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    // Invalidate cache
    await redis.del(`goal:${id}`);
    await redis.del(`goals:${userId}`);

    res.status(200).json({
      success: true,
      goal: updatedGoal
    });
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update goal'
    });
  }
};

/**
 * Delete a goal
 * @route DELETE /api/goals/:id
 * @access Private
 */
exports.deleteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Find goal
    const goal = await Goal.findOne({ _id: id, userId });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }
    
    // Delete goal
    await Goal.findByIdAndDelete(id);
    
    // Invalidate cache
    await redis.del(`goal:${id}`);
    await redis.del(`goals:${userId}`);
    
    res.status(200).json({
      success: true,
      message: 'Goal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting goal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete goal'
    });
  }
};

/**
 * Contribute to a goal
 * @route POST /api/goals/:id/contribute
 * @access Private
 */
exports.contributeToGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, privateKey } = req.body;
    const userId = req.user.id;
    
    // Find goal
    const goal = await Goal.findOne({ _id: id, userId });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }
    
    // Contribute on blockchain
    const result = await blockchainService.contributeToGoal(
      privateKey, 
      goal.blockchainId, 
      amount
    );
    
    // Update goal in database
    const newAmount = goal.currentAmount + parseFloat(amount);
    const newStatus = newAmount >= goal.targetAmount ? 'completed' : 'active';
    
    const updatedGoal = await Goal.findByIdAndUpdate(
      id,
      {
        currentAmount: newAmount,
        status: newStatus,
        $push: {
          contributions: {
            amount: parseFloat(amount),
            date: new Date(),
            txHash: result.txHash
          }
        }
      },
      { new: true }
    );
    
    // Invalidate cache
    await redis.del(`goal:${id}`);
    await redis.del(`goals:${userId}`);
    
    // Send notification if goal completed
    if (newStatus === 'completed' && req.user.phoneNumber) {
      twilioService.sendSMS(
        req.user.phoneNumber,
        `Congratulations! You've completed your "${goal.name}" goal by reaching your target of ${goal.targetAmount} USDC.`
      );
    }
    
    res.status(200).json({
      success: true,
      goal: updatedGoal,
      transaction: result
    });
  } catch (error) {
    console.error('Error contributing to goal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to contribute to goal'
    });
  }
};

exports.getGoalProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Find goal
    const goal = await Goal.findOne({ _id: id, userId });
    
    if (!goal) {
      return res.status(404).json({
        success: false,
        error: 'Goal not found'
      });
    }
    
    // Calculate progress
    const progressPercentage = Math.min(
      100,
      Math.round((goal.currentAmount / goal.targetAmount) * 100)
    );
    
    // Calculate time progress
    const startDate = new Date(goal.startDate);
    const endDate = new Date(goal.endDate);
    const now = new Date();
    
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    
    const timeProgressPercentage = Math.min(
      100,
      Math.round((elapsedDays / totalDays) * 100)
    );
    
    // Check if on track
    const isOnTrack = progressPercentage >= timeProgressPercentage;
    
    // Calculate daily amount needed
    const dailyAmountNeeded = remainingDays > 0
      ? (goal.targetAmount - goal.currentAmount) / remainingDays
      : 0;
    
    res.status(200).json({
      success: true,
      goal,
      progress: {
        progressPercentage,
        timeProgressPercentage,
        elapsedDays,
        remainingDays,
        isOnTrack,
        dailyAmountNeeded
      }
    });
  } catch (error) {
    console.error('Error fetching goal progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch goal progress'
    });
  }
};