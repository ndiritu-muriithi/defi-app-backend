const Queue = require('bull');
const redis = require('../config/redis');
const config = require('../config/env');
const twilioService = require('./twilioService');
const User = require('../models/User');
const Goal = require('../models/Goal');
const Challenge = require('../models/Challenge');

// Create queues
const reminderQueue = new Queue('goal-reminders', {
  redis: {
    host: redis.options.host,
    port: redis.options.port,
    password: redis.options.password
  }
});

const challengeQueue = new Queue('challenge-updates', {
  redis: {
    host: redis.options.host,
    port: redis.options.port,
    password: redis.options.password
  }
});

// Process goal reminders
reminderQueue.process(async (job) => {
  try {
    const { userId, goalId } = job.data;
    
    // Get user and goal
    const user = await User.findById(userId);
    const goal = await Goal.findById(goalId);
    
    if (!user || !goal || !user.phoneNumber) {
      console.log(`Skipping reminder for goal ${goalId} - missing user or goal data`);
      return;
    }
    
    // Calculate progress
    const progressPercentage = Math.min(
      100,
      Math.round((goal.currentAmount / goal.targetAmount) * 100)
    );
    
    // Calculate days remaining
    const now = new Date();
    const endDate = new Date(goal.endDate);
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    // Send SMS reminder
    await twilioService.sendSMS(
      user.phoneNumber,
      `Reminder: Your "${goal.name}" goal is ${progressPercentage}% complete. You have ${daysRemaining} days left to reach your target of ${goal.targetAmount} USDC.`
    );
    
    console.log(`Sent reminder for goal ${goalId} to user ${userId}`);
    
    // Update last reminder sent
    await Goal.findByIdAndUpdate(goalId, {
      lastReminderSent: new Date()
    });
  } catch (error) {
    console.error('Error processing reminder:', error);
    throw error;
  }
});

// Process challenge updates
challengeQueue.process(async (job) => {
  try {
    const { type, challengeId } = job.data;
    
    // Handle different types of challenge updates
    switch (type) {
      case 'start':
        await handleChallengeStart(challengeId);
        break;
      case 'end':
        await handleChallengeEnd(challengeId);
        break;
      case 'reminder':
        await handleChallengeReminder(challengeId);
        break;
      default:
        console.log(`Unknown challenge update type: ${type}`);
    }
  } catch (error) {
    console.error('Error processing challenge update:', error);
    throw error;
  }
});

// Handle challenge start
async function handleChallengeStart(challengeId) {
  try {
    // Update challenge status
    const challenge = await Challenge.findByIdAndUpdate(
      challengeId,
      { status: 'active' },
      { new: true }
    ).populate('participants.user');
    
    if (!challenge) {
      console.log(`Challenge ${challengeId} not found`);
      return;
    }
    
    // Notify participants
    for (const participant of challenge.participants) {
      const user = participant.user;
      if (user.phoneNumber) {
        await twilioService.sendSMS(
          user.phoneNumber,
          `The "${challenge.name}" challenge has started! Your target: ${challenge.targetAmount} USDC by ${new Date(challenge.endDate).toLocaleDateString()}.`
        );
      }
    }
    
    // Invalidate cache
    await redis.del('challenges:global');
    
    console.log(`Started challenge ${challengeId}`);
  } catch (error) {
    console.error('Error handling challenge start:', error);
    throw error;
  }
}

// Handle challenge end
async function handleChallengeEnd(challengeId) {
  try {
    // Get challenge with participants
    const challenge = await Challenge.findById(challengeId)
      .populate('participants.user');
    
    if (!challenge) {
      console.log(`Challenge ${challengeId} not found`);
      return;
    }
    
    // Update challenge status
    challenge.status = 'completed';
    await challenge.save();
    
    // Process rewards and notify participants
    for (const participant of challenge.participants) {
      // Check if participant completed the challenge
      if (participant.status === 'completed') {
        // In a real implementation, distribute rewards here
        
        // Notify user
        const user = participant.user;
        if (user.phoneNumber) {
          await twilioService.sendSMS(
            user.phoneNumber,
            `Congratulations! You've successfully completed the "${challenge.name}" challenge and earned: ${challenge.reward}`
          );
        }
      } else {
        // Mark as failed
        participant.status = 'failed';
        
        // Notify user
        const user = participant.user;
        if (user.phoneNumber) {
          await twilioService.sendSMS(
            user.phoneNumber,
            `The "${challenge.name}" challenge has ended. You reached ${Math.round((participant.currentAmount / challenge.targetAmount) * 100)}% of the target. Better luck next time!`
          );
        }
      }
    }
    
    await challenge.save();
    
    // Invalidate cache
    await redis.del('challenges:global');
    
    console.log(`Completed challenge ${challengeId}`);
  } catch (error) {
    console.error('Error handling challenge end:', error);
    throw error;
  }
}

// Handle challenge reminder
async function handleChallengeReminder(challengeId) {
  try {
    // Get challenge with participants
    const challenge = await Challenge.findById(challengeId)
      .populate('participants.user');
    
    if (!challenge) {
      console.log(`Challenge ${challengeId} not found`);
      return;
    }
    
    // Calculate days remaining
    const now = new Date();
    const endDate = new Date(challenge.endDate);
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    // Only send reminders if challenge is active
    if (challenge.status !== 'active') {
      return;
    }
    
    // Send reminders to participants
    for (const participant of challenge.participants) {
      if (participant.status !== 'active') continue;
      
      const user = participant.user;
      if (user.phoneNumber) {
        const progressPercentage = Math.min(
          100,
          Math.round((participant.currentAmount / challenge.targetAmount) * 100)
        );
        
        const remainingAmount = challenge.targetAmount - participant.currentAmount;
        
        await twilioService.sendSMS(
          user.phoneNumber,
          `Challenge Reminder: "${challenge.name}" is ${progressPercentage}% complete. You need ${remainingAmount} USDC more in ${daysRemaining} days to win and earn: ${challenge.reward}`
        );
      }
    }
    
    console.log(`Sent reminders for challenge ${challengeId}`);
  } catch (error) {
    console.error('Error handling challenge reminder:', error);
    throw error;
  }
}

// Schedule functions
async function scheduleGoalReminders() {
  try {
    // Get all active goals with reminders
    const goals = await Goal.find({
      status: 'active',
      reminderFrequency: { $exists: true, $ne: null }
    }).populate('userId');
    
    console.log(`Scheduling reminders for ${goals.length} goals`);
    
    for (const goal of goals) {
      const user = goal.userId;
      if (!user || !user.phoneNumber) continue;
      
      let delayInDays = 1;
      
      // Determine delay based on reminder frequency
      switch (goal.reminderFrequency) {
        case 'daily':
          delayInDays = 1;
          break;
        case 'weekly':
          delayInDays = 7;
          break;
        case 'monthly':
          delayInDays = 30;
          break;
        default:
          delayInDays = 7;
      }
      
      // Check if we should schedule a reminder
      let shouldSchedule = false;
      
      if (!goal.lastReminderSent) {
        shouldSchedule = true;
      } else {
        const lastSent = new Date(goal.lastReminderSent);
        const daysSinceLastReminder = Math.ceil(
          (new Date() - lastSent) / (1000 * 60 * 60 * 24)
        );
        
        shouldSchedule = daysSinceLastReminder >= delayInDays;
      }
      
      if (shouldSchedule) {
        // Schedule reminder
        await reminderQueue.add(
          {
            userId: user._id,
            goalId: goal._id
          },
          {
            delay: 1000, // Send immediately for demo (in production, adjust timing)
            attempts: 3,
            removeOnComplete: true
          }
        );
      }
    }
  } catch (error) {
    console.error('Error scheduling goal reminders:', error);
  }
}

async function scheduleChallengeUpdates() {
  try {
    const now = new Date();
    
    // Start upcoming challenges that should be active
    const upcomingChallenges = await Challenge.find({
      status: 'upcoming',
      startDate: { $lte: now }
    });
    
    for (const challenge of upcomingChallenges) {
      await challengeQueue.add(
        {
          type: 'start',
          challengeId: challenge._id
        },
        {
          delay: 1000, // Send immediately for demo
          attempts: 3,
          removeOnComplete: true
        }
      );
    }
    
    // End active challenges that should be completed
    const activeChallenges = await Challenge.find({
      status: 'active',
      endDate: { $lte: now }
    });
    
    for (const challenge of activeChallenges) {
      await challengeQueue.add(
        {
          type: 'end',
          challengeId: challenge._id
        },
        {
          delay: 1000, // Send immediately for demo
          attempts: 3,
          removeOnComplete: true
        }
      );
    }
    
    // Send reminders for active challenges ending soon (within 3 days)
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + 3);
    
    const challengesEndingSoon = await Challenge.find({
      status: 'active',
      endDate: { $lte: reminderDate, $gt: now }
    });
    
    for (const challenge of challengesEndingSoon) {
      await challengeQueue.add(
        {
          type: 'reminder',
          challengeId: challenge._id
        },
        {
          delay: 1000, // Send immediately for demo
          attempts: 3,
          removeOnComplete: true
        }
      );
    }
  } catch (error) {
    console.error('Error scheduling challenge updates:', error);
  }
}

// Export schedulers and queues
module.exports = {
  reminderQueue,
  challengeQueue,
  scheduleGoalReminders,
  scheduleChallengeUpdates
};