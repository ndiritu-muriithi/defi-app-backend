/**
 * Goal Model
 * Defines the savings goal schema for the application
 * 
 * 
 */

const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Goal name is required'],
      trim: true,
      maxlength: [100, 'Goal name cannot be more than 100 characters']
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot be more than 500 characters']
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    targetAmount: {
      type: Number,
      required: [true, 'Target amount is required'],
      min: [1, 'Target amount must be at least 1']
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: [0, 'Current amount cannot be negative']
    },
    deadline: {
      type: Date,
      required: [true, 'Goal deadline is required']
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date
    },
    category: {
      type: String,
      enum: ['land', 'business', 'education', 'emergency', 'retirement', 'travel', 'vehicle', 'home', 'family', 'health', 'debt', 'crypto', 'other'],
      default: 'other'
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'paused'],
      default: 'active'
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    icon: {
      type: String,
      default: 'target'
    },
    color: {
      type: String,
      default: '#4CAF50' // Green by default
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'friends'],
      default: 'private'
    },
    reminder: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'none'],
        default: 'weekly'
      },
      enabled: {
        type: Boolean,
        default: true
      },
      lastSent: {
        type: Date
      },
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
        default: 1 // Monday by default
      }
    },
    recurringDeposit: {
      amount: {
        type: Number,
        min: 0,
        default: 0
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'none'],
        default: 'none'
      },
      enabled: {
        type: Boolean,
        default: false
      },
      lastProcessed: {
        type: Date
      }
    },
    blockchain: {
      registered: {
        type: Boolean,
        default: false
      },
      txHash: {
        type: String
      },
      goalId: {
        type: String
      },
      lastSynced: {
        type: Date
      }
    },
    milestones: [{
      name: {
        type: String,
        required: true
      },
      targetAmount: {
        type: Number,
        required: true
      },
      reward: {
        type: String
      },
      completed: {
        type: Boolean,
        default: false
      },
      completedAt: {
        type: Date
      }
    }],
    transactions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }],
    attachments: [{
      name: {
        type: String
      },
      url: {
        type: String
      },
      type: {
        type: String,
        enum: ['image', 'document', 'other'],
        default: 'image'
      },
      uploadedAt: {
        type: Date,
        default: Date.now
      }
    }],
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot be more than 1000 characters']
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for faster queries
GoalSchema.index({ userId: 1, status: 1 });
GoalSchema.index({ deadline: 1 }, { expireAfterSeconds: 7776000, partialFilterExpression: { status: 'completed' } }); // Remove completed goals after 90 days
GoalSchema.index({ userId: 1, category: 1 });

// Virtual field for progress percentage
GoalSchema.virtual('progressPercentage').get(function() {
  if (this.targetAmount === 0) return 0;
  const percentage = (this.currentAmount / this.targetAmount) * 100;
  return Math.min(100, Math.round(percentage * 100) / 100); // Round to 2 decimal places and cap at 100%
});

// Virtual field for time progress percentage
GoalSchema.virtual('timeProgressPercentage').get(function() {
  if (this.status !== 'active') return 100;
  
  const startDate = new Date(this.startDate).getTime();
  const deadline = new Date(this.deadline).getTime();
  const now = Date.now();
  
  if (now >= deadline) return 100;
  if (deadline === startDate) return 100;
  
  const totalDuration = deadline - startDate;
  const elapsedDuration = now - startDate;
  
  const percentage = (elapsedDuration / totalDuration) * 100;
  return Math.min(100, Math.round(percentage * 100) / 100); // Round to 2 decimal places and cap at 100%
});

// Virtual field for days remaining
GoalSchema.virtual('daysRemaining').get(function() {
  if (this.status !== 'active') return 0;
  
  const now = new Date();
  const deadline = new Date(this.deadline);
  
  if (now >= deadline) return 0;
  
  const diffTime = Math.abs(deadline - now);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

// Virtual field for daily saving requirement
GoalSchema.virtual('dailySavingRequirement').get(function() {
  if (this.status !== 'active' || this.progressPercentage >= 100) return 0;
  
  const daysRemaining = this.daysRemaining;
  if (daysRemaining <= 0) return this.targetAmount - this.currentAmount;
  
  const remainingAmount = this.targetAmount - this.currentAmount;
  return Math.round((remainingAmount / daysRemaining) * 100) / 100; // Round to 2 decimal places
});

// Virtual field for on track status
GoalSchema.virtual('onTrack').get(function() {
  if (this.status !== 'active') return false;
  
  // If progress percentage is greater than time progress percentage, we're on track
  return this.progressPercentage >= this.timeProgressPercentage;
});

// Pre-save hook to check if goal is completed
GoalSchema.pre('save', function(next) {
  // If current amount reaches or exceeds target amount and status is active, mark as completed
  if (this.currentAmount >= this.targetAmount && this.status === 'active') {
    this.status = 'completed';
    this.completedAt = new Date();
  }
  
  // Update milestones
  if (this.milestones && this.milestones.length > 0) {
    this.milestones.forEach(milestone => {
      if (!milestone.completed && this.currentAmount >= milestone.targetAmount) {
        milestone.completed = true;
        milestone.completedAt = new Date();
      }
    });
  }
  
  next();
});

// Static method to find goals that need reminders
GoalSchema.statics.findGoalsNeedingReminders = async function() {
  const now = new Date();
  
  // Get day of week (0-6, 0 is Sunday)
  const dayOfWeek = now.getDay();
  
  return this.find({
    status: 'active',
    'reminder.enabled': true,
    $or: [
      // Daily reminders
      {
        'reminder.frequency': 'daily',
        $or: [
          { 'reminder.lastSent': { $exists: false } },
          { 'reminder.lastSent': { $lt: new Date(now.setHours(0, 0, 0, 0)) } }
        ]
      },
      // Weekly reminders matching today's day of week
      {
        'reminder.frequency': 'weekly',
        'reminder.dayOfWeek': dayOfWeek,
        $or: [
          { 'reminder.lastSent': { $exists: false } },
          { 'reminder.lastSent': { $lt: new Date(now.setDate(now.getDate() - 7)) } }
        ]
      },
      // Monthly reminders matching today's day of month
      {
        'reminder.frequency': 'monthly',
        $or: [
          { 'reminder.lastSent': { $exists: false } },
          { 'reminder.lastSent': { $lt: new Date(now.setMonth(now.getMonth() - 1)) } }
        ]
      }
    ]
  }).populate('userId', 'name email phoneNumber');
};

// Static method to find goals with upcoming deadlines
GoalSchema.statics.findGoalsWithUpcomingDeadlines = async function(daysThreshold = 7) {
  const now = new Date();
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  
  return this.find({
    status: 'active',
    deadline: {
      $gte: now,
      $lte: thresholdDate
    }
  }).populate('userId', 'name email phoneNumber');
};

// Static method to find goals with recurring deposits due
GoalSchema.statics.findGoalsWithRecurringDeposits = async function() {
  const now = new Date();
  
  return this.find({
    status: 'active',
    'recurringDeposit.enabled': true,
    'recurringDeposit.amount': { $gt: 0 },
    $or: [
      // Daily recurring deposits
      {
        'recurringDeposit.frequency': 'daily',
        $or: [
          { 'recurringDeposit.lastProcessed': { $exists: false } },
          { 'recurringDeposit.lastProcessed': { $lt: new Date(now.setHours(0, 0, 0, 0)) } }
        ]
      },
      // Weekly recurring deposits
      {
        'recurringDeposit.frequency': 'weekly',
        $or: [
          { 'recurringDeposit.lastProcessed': { $exists: false } },
          { 'recurringDeposit.lastProcessed': { $lt: new Date(now.setDate(now.getDate() - 7)) } }
        ]
      },
      // Monthly recurring deposits
      {
        'recurringDeposit.frequency': 'monthly',
        $or: [
          { 'recurringDeposit.lastProcessed': { $exists: false } },
          { 'recurringDeposit.lastProcessed': { $lt: new Date(now.setMonth(now.getMonth() - 1)) } }
        ]
      }
    ]
  }).populate('userId', 'name email phoneNumber walletAddress');
};

// Method to calculate the monthly saving plan
GoalSchema.methods.calculateMonthlySavingPlan = function() {
  if (this.status !== 'active') return [];
  
  const now = new Date();
  const deadline = new Date(this.deadline);
  
  if (now >= deadline) return [];
  
  const remainingAmount = this.targetAmount - this.currentAmount;
  if (remainingAmount <= 0) return [];
  
  // Calculate number of months between now and deadline
  const monthsDiff = (deadline.getFullYear() - now.getFullYear()) * 12 + 
                     (deadline.getMonth() - now.getMonth());
  
  const months = Math.max(1, monthsDiff);
  const monthlyAmount = remainingAmount / months;
  
  const plan = [];
  let currentDate = new Date(now);
  let remainingGoalAmount = remainingAmount;
  
  for (let i = 0; i < months; i++) {
    // Adjust the last month to account for rounding
    const thisMonthAmount = i === months - 1 
      ? remainingGoalAmount 
      : monthlyAmount;
    
    plan.push({
      month: new Date(currentDate),
      amount: Math.round(thisMonthAmount * 100) / 100
    });
    
    remainingGoalAmount -= thisMonthAmount;
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return plan;
};

module.exports = mongoose.model('Goal', GoalSchema);