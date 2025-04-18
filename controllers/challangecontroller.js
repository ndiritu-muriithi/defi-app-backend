const challenge = require('../models/challenge');
const transaction = require('../models/transaction');
const user = require('../models/user');
const redis = require('../config/redis');
const twilioService = require('../services/twilioService');

exports.createChallenge = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      startDate,
      endDate,
      targetAmount,
      reward,
      rewardAmount,
      isGlobal
    } = req.body;
    
    const userId = req.user.id;
    
    // Create challenge
    const challenge = await Challenge.create({
      name,
      description,
      type,
      startDate,
      endDate,
      targetAmount,
      reward,
      rewardAmount,
      isGlobal,
      createdBy: isGlobal ? null : userId,
      status: new Date(startDate) <= new Date() ? 'active' : 'upcoming'
    });
    
    // Invalidate cache
    await redis.del('challenges:global');
    
    res.status(201).json({
      success: true,
      challenge
    });
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create challenge'
    });
  }
};

exports.getChallenges = async (req, res) => {
  try {
    const { status } = req.query;
    
    // Try to get from cache if querying for active global challenges
    if (status === 'active' && !req.query.onlyMine) {
      const cachedChallenges = await redis.get('challenges:global');
      if (cachedChallenges) {
        return res.status(200).json({
          success: true,
          challenges: JSON.parse(cachedChallenges),
          fromCache: true
        });
      }
    }
    
    // Build query
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    // If only user's challenges
    if (req.query.onlyMine === 'true') {
      query['participants.user'] = req.user.id;
    }
    
    // Get challenges
    const challenges = await Challenge.find(query)
      .sort({ startDate: 1 })
      .populate('participants.user', 'name email walletAddress');
    
    // Cache active global challenges for 5 minutes
    if (status === 'active' && !req.query.onlyMine) {
      await redis.set('challenges:global', JSON.stringify(challenges), 'EX', 300);
    }
    
    res.status(200).json({
      success: true,
      challenges
    });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch challenges'
    });
  }
};

exports.joinChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Find challenge
    const challenge = await Challenge.findById(id);
    
    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: 'Challenge not found'
      });
    }
    
    // Check if user already joined
    const alreadyJoined = challenge.participants.some(
      p => p.user.toString() === userId.toString()
    );
    
    if (alreadyJoined) {
      return res.status(400).json({
        success: false,
        error: 'You have already joined this challenge'
      });
    }
    
    // Check if challenge is active or upcoming
    if (challenge.status !== 'active' && challenge.status !== 'upcoming') {
      return res.status(400).json({
        success: false,
        error: 'This challenge is no longer open for joining'
      });
    }
    
    // Add user to participants
    challenge.participants.push({
      user: userId,
      joined: new Date(),
      currentAmount: 0,
      status: 'active'
    });
    
    await challenge.save();
    
    // Invalidate cache
    await redis.del('challenges:global');
    
    // Get user for notification
    const user = await User.findById(userId);
    
    // Send notification if user has phone number
    if (user.phoneNumber) {
      twilioService.sendSMS(
        user.phoneNumber,
        `You've joined the "${challenge.name}" challenge! Target: ${challenge.targetAmount} USDC by ${new Date(challenge.endDate).toLocaleDateString()}.`
      );
    }
    
    res.status(200).json({
      success: true,
      message: 'Successfully joined challenge',
      challenge
    });
  } catch (error) {
    console.error('Error joining challenge:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join challenge'
    });
  }
};

exports.updateChallengeProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { txHash } = req.body;
    const userId = req.user.id;
    
    // Find challenge
    const challenge = await Challenge.findById(id);
    
    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: 'Challenge not found'
      });
    }
    
    // Find participant
    const participantIndex = challenge.participants.findIndex(
      p => p.user.toString() === userId.toString()
    );
    
    if (participantIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'You are not a participant in this challenge'
      });
    }
    
    // Find transaction
    const transaction = await Transaction.findOne({ txHash });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    // Check if transaction already recorded for this challenge
    const transactionExists = challenge.participants[participantIndex].transactions.some(
      t => t.txHash === txHash
    );
    
    if (transactionExists) {
      return res.status(400).json({
        success: false,
        error: 'Transaction already recorded for this challenge'
      });
    }
    
    // Ensure it's a deposit transaction
    if (transaction.type !== 'deposit') {
      return res.status(400).json({
        success: false,
        error: 'Only deposit transactions can be used for challenge progress'
      });
    }
    
    // Add transaction and update amount
    challenge.participants[participantIndex].transactions.push({
      amount: transaction.amount,
      date: transaction.timestamp,
      txHash: transaction.txHash
    });
    
    // Update current amount
    challenge.participants[participantIndex].currentAmount += transaction.amount;
    
    // Check if target reached
    if (challenge.participants[participantIndex].currentAmount >= challenge.targetAmount) {
      challenge.participants[participantIndex].status = 'completed';
      
      // Get user for notification
      const user = await User.findById(userId);
      
      // Send notification if user has phone number
      if (user.phoneNumber) {
        twilioService.sendSMS(
          user.phoneNumber,
          `Congratulations! You've completed the "${challenge.name}" challenge and earned the reward: ${challenge.reward}`
        );
      }
    }
    
    await challenge.save();
    
    // Invalidate cache
    await redis.del('challenges:global');
    
    res.status(200).json({
      success: true,
      message: 'Challenge progress updated',
      challenge
    });
  } catch (error) {
    console.error('Error updating challenge progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update challenge progress'
    });
  }
};

exports.getChallengeLeaderboard = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find challenge
    const challenge = await Challenge.findById(id)
      .populate('participants.user', 'name email walletAddress');
    
    if (!challenge) {
      return res.status(404).json({
        success: false,
        error: 'Challenge not found'
      });
    }
    
    // Create leaderboard
    const leaderboard = challenge.participants
      .map(participant => ({
        user: {
          id: participant.user._id,
          name: participant.user.name,
          walletAddress: participant.user.walletAddress
        },
        currentAmount: participant.currentAmount,
        status: participant.status,
        progress: Math.min(100, Math.round((participant.currentAmount / challenge.targetAmount) * 100))
      }))
      .sort((a, b) => b.currentAmount - a.currentAmount);
    
    res.status(200).json({
      success: true,
      challenge: {
        id: challenge._id,
        name: challenge.name,
        description: challenge.description,
        targetAmount: challenge.targetAmount,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        status: challenge.status
      },
      leaderboard
    });
  } catch (error) {
    console.error('Error fetching challenge leaderboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch challenge leaderboard'
    });
  }
};