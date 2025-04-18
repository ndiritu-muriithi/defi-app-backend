const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    },
    userAddress: {
      type: String,
      lowercase: true,
      sparse: true
    },
    walletAddress: {
      type: String,
      lowercase: true,
      sparse: true
    },
    type: {
      type: String,
      enum: [
        'deposit',
        'withdrawal',
        'mpesa_deposit',
        'mpesa_withdrawal',
        'goal_contribution',
        'swap'
      ],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'completed'
    },
    txHash: {
      type: String,
      sparse: true,
      unique: true
    },
    mpesaReference: {
      type: String,
      sparse: true,
      unique: true
    },
    phoneNumber: {
      type: String,
      sparse: true
    },
    goalId: {
      type: String,
      sparse: true
    },
    blockNumber: {
      type: Number,
      sparse: true
    },
    error: {
      type: String,
      sparse: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Create indexes
transactionSchema.index({ userAddress: 1, timestamp: -1 });
transactionSchema.index({ walletAddress: 1, timestamp: -1 });
transactionSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);