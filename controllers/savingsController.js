const User = require('../models/user');
const Transaction = require('../models/transaction');
const blockchainService = require('../services/blockchainservice');
const redis = require('../config/redis');

/**
 * Get user's savings balance
 * @route GET /api/savings/balance/:address
 * @access Public
 */
exports.getBalance = async (req, res) => {
  try {
    const { address } = req.params;
    
    // Try to get from cache first
    const cacheKey = `balance:${address}`;
    const cachedBalance = await redis.get(cacheKey);
    
    if (cachedBalance) {
      return res.status(200).json({
        success: true,
        balance: JSON.parse(cachedBalance),
        fromCache: true
      });
    }
    
    // Get balance from blockchain
    const balance = await blockchainService.getBalance(address);
    
    // Cache for 1 minute
    await redis.set(cacheKey, JSON.stringify(balance), 'EX', 60);
    
    res.status(200).json({
      success: true,
      balance
    });
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get balance'
    });
  }
};

/**
 * Deposit cryptocurrency
 * @route POST /api/savings/deposit/crypto
 * @access Private
 */
exports.depositCrypto = async (req, res) => {
  try {
    const { amount, privateKey } = req.body;
    const userId = req.user.id;
    const walletAddress = req.user.walletAddress;
    
    // Deposit on blockchain
    const result = await blockchainService.deposit(privateKey, amount);
    
    // Create transaction record
    const transaction = await Transaction.create({
      userId,
      type: 'deposit',
      amount,
      status: 'completed',
      txHash: result.txHash,
      walletAddress
    });
    
    // Invalidate balance cache
    await redis.del(`balance:${walletAddress}`);
    
    res.status(200).json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('Error depositing crypto:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deposit crypto'
    });
  }
};

/**
 * Deposit via M-Pesa
 * @route POST /api/savings/deposit/mpesa
 * @access Private
 */
exports.depositMpesa = async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;
    const userId = req.user.id;
    
    // Initiate M-Pesa payment
    const result = await blockchainService.initiateMpesaPayment(phoneNumber, amount);
    
    // Create pending transaction
    const transaction = await Transaction.create({
      userId,
      type: 'deposit',
      amount,
      status: 'pending',
      mpesaRequestId: result.requestId,
      phoneNumber
    });
    
    res.status(200).json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('Error initiating M-Pesa deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate M-Pesa deposit'
    });
  }
};

/**
 * M-Pesa callback handler
 * @route POST /api/savings/mpesa/callback
 * @access Public
 */
exports.mpesaCallback = async (req, res) => {
  try {
    const { requestId, status, amount } = req.body;
    
    // Find pending transaction
    const transaction = await Transaction.findOne({ mpesaRequestId: requestId });
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    if (status === 'success') {
      // Update transaction status
      transaction.status = 'completed';
      await transaction.save();
      
      // Get user's wallet address
      const user = await User.findById(transaction.userId);
      
      // Deposit to blockchain
      await blockchainService.deposit(user.privateKey, amount);
      
      // Invalidate balance cache
      await redis.del(`balance:${user.walletAddress}`);
    } else {
      // Update transaction status
      transaction.status = 'failed';
      await transaction.save();
    }
    
    res.status(200).json({
      success: true
    });
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process M-Pesa callback'
    });
  }
};

/**
 * Withdraw cryptocurrency
 * @route POST /api/savings/withdraw/crypto
 * @access Private
 */
exports.withdraw = async (req, res) => {
  try {
    const { amount, address, privateKey } = req.body;
    const userId = req.user.id;
    const walletAddress = req.user.walletAddress;
    
    // Withdraw from blockchain
    const result = await blockchainService.withdraw(privateKey, amount, address);
    
    // Create transaction record
    const transaction = await Transaction.create({
      userId,
      type: 'withdrawal',
      amount,
      status: 'completed',
      txHash: result.txHash,
      walletAddress,
      destinationAddress: address
    });
    
    // Invalidate balance cache
    await redis.del(`balance:${walletAddress}`);
    
    res.status(200).json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('Error withdrawing crypto:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to withdraw crypto'
    });
  }
};

/**
 * Withdraw to M-Pesa
 * @route POST /api/savings/withdraw/mpesa
 * @access Private
 */
exports.withdrawToMpesa = async (req, res) => {
  try {
    const { amount, phoneNumber } = req.body;
    const userId = req.user.id;
    const walletAddress = req.user.walletAddress;
    
    // Withdraw from blockchain
    const result = await blockchainService.withdrawToMpesa(
      req.user.privateKey,
      amount,
      phoneNumber
    );
    
    // Create transaction record
    const transaction = await Transaction.create({
      userId,
      type: 'withdrawal',
      amount,
      status: 'completed',
      txHash: result.txHash,
      walletAddress,
      phoneNumber
    });
    
    // Invalidate balance cache
    await redis.del(`balance:${walletAddress}`);
    
    res.status(200).json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('Error withdrawing to M-Pesa:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to withdraw to M-Pesa'
    });
  }
};

/**
 * Get transaction history
 * @route GET /api/savings/transactions/:address
 * @access Private
 */
exports.getTransactions = async (req, res) => {
  try {
    const { address } = req.params;
    const userId = req.user.id;
    
    // Try to get from cache first
    const cacheKey = `transactions:${address}`;
    const cachedTransactions = await redis.get(cacheKey);
    
    if (cachedTransactions) {
      return res.status(200).json({
        success: true,
        transactions: JSON.parse(cachedTransactions),
        fromCache: true
      });
    }
    
    // Get transactions from database
    const transactions = await Transaction.find({
      $or: [
        { walletAddress: address },
        { destinationAddress: address }
      ]
    }).sort({ createdAt: -1 });
    
    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(transactions), 'EX', 300);
    
    res.status(200).json({
      success: true,
      transactions
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions'
    });
  }
}; 