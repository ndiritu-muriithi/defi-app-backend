const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Challenge name is required'],
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Challenge description is required']
    },
    type: {
      type: String,
      enum: ['savings', 'deposit', 'streak', 'community'],
      default: 'savings'
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required']
    },
    targetAmount: {
      type: Number,
      default: 0
    },
    reward: {
      type: String,
      required: [true, 'Reward description is required']
    },
    rewardAmount: {
      type: Number,
      default: 0
    },
    isGlobal: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    },
    participants: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      joined: {
        type: Date,
        default: Date.now
      },
      currentAmount: {
        type: Number,
        default: 0
      },
      status: {
        type: String,
        enum: ['active', 'completed', 'failed'],
        default: 'active'
      },
      transactions: [{
        amount: Number,
        date: Date,
        txHash: String
      }]
    }],
    status: {
      type: String,
      enum: ['upcoming', 'active', 'completed', 'cancelled'],
      default: 'upcoming'
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
challengeSchema.index({ status: 1, startDate: 1 });
challengeSchema.index({ 'participants.user': 1 });

module.exports = mongoose.model('Challenge', challengeSchema);