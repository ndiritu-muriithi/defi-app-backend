const blockchainservice = require('../services/blockchainservice');
const mpesaService = require('../services/mpesaService');
const uniswapService = require('../services/uniswapService');
const twilioService = require('../services/twilioService');
const Transaction = require('../models/transaction');
const User = require('../models/user');
const redis = require('../config/redis');

exports.getBalance = async (req, res) => {
  try {
    const { address } = req.params;
    const balance = await blockchainService.getBalance(address);
    
    res.status(200).json({
      success: true,
      balance: balance.toString(),
      formattedBalance: ethers.formatUnits(balance, 6)
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch balance' });
  }
};

exports.depositCrypto = async (req, res) => {
  try {
    const { amount, privateKey } = req.body;
    
    // Validate inputs
    if (!amount || amount <= 0 || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input parameters'
      });
    }
    
    // Perform deposit
    const result = await blockchainService.deposit(privateKey, amount);
    
    // Return result
    res.status(200).json({
      success: true,
      transaction: result
    });
  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process deposit'
    });
  }
};

exports.depositMpesa = async (req, res) => {
  try {
    const { phoneNumber, amount, userId } = req.body;
    
    // Validate inputs
    if (!phoneNumber || !amount || amount <= 0 || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input parameters'
      });
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Generate account reference
    const accountRef = `BZU${userId}`;
    
    // Initiate STK push
    const mpesaResponse = await mpesaService.initiateDeposit(
      phoneNumber,
      amount,
      accountRef
    );
    
    // Save transaction reference in Redis with expiry
    await redis.set(
      `mpesa:${mpesaResponse.CheckoutRequestID}`,
      JSON.stringify({
        userId,
        amount,
        walletAddress: user.walletAddress,
        status: 'pending',
        createdAt: new Date().toISOString()
      }),
      'EX',
      3600  // 1 hour expiry
    );
    
    // Return STK push result
    res.status(200).json({
      success: true,
      requestId: mpesaResponse.CheckoutRequestID,
      message: 'STK push sent. Please complete payment on your phone.'
    });
  } catch (error) {
    console.error('Error processing M-Pesa deposit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process M-Pesa deposit'
    });
  }
};

exports.mpesaCallback = async (req, res) => {
  try {
    // Extract relevant data from callback
    const {
      Body: {
        stkCallback: {
          MerchantRequestID,
          CheckoutRequestID,
          ResultCode,
          ResultDesc,
          CallbackMetadata
        }
      }
    } = req.body;
    
    // Get transaction details from Redis
    const txDetails = await redis.get(`mpesa:${CheckoutRequestID}`);
    
    if (!txDetails) {
      console.error('Transaction details not found in Redis');
      // Return success to M-Pesa even if we can't process
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }
    
    const { userId, amount, walletAddress } = JSON.parse(txDetails);
    
    // Process success or failure
    if (ResultCode === 0) {
      // Payment successful
      
      // Get transaction amount and phone from metadata
      let transactionAmount = amount;
      let phoneNumber = '';
      
      if (CallbackMetadata && CallbackMetadata.Item) {
        for (const item of CallbackMetadata.Item) {
          if (item.Name === 'Amount') transactionAmount = item.Value;
          if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
        }
      }
      
      // Save transaction record
      await Transaction.create({
        userId,
        type: 'mpesa_deposit',
        status: 'completed',
        amount: transactionAmount,
        mpesaReference: CheckoutRequestID,
        phoneNumber,
        walletAddress,
        timestamp: Date.now()
      });
      
      // Send notification
      await twilioService.sendSMS(
        phoneNumber,
        `Your M-Pesa payment of KES ${transactionAmount} has been received. Your BazuuSave account will be credited shortly.`
      );
      
      // In a real implementation, we would now:
      // 1. Convert KES to USDC via an exchange
      // 2. Use the admin wallet to deposit USDC to the user's savings
      
    } else {
      // Payment failed
      await Transaction.create({
        userId,
        type: 'mpesa_deposit',
        status: 'failed',
        amount: amount,
        mpesaReference: CheckoutRequestID,
        error: ResultDesc,
        walletAddress,
        timestamp: Date.now()
      });
    }
    
    // Delete from Redis
    await redis.del(`mpesa:${CheckoutRequestID}`);
    
    // Always return success to M-Pesa
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error);
    // Always return success to M-Pesa, handle error internally
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

exports.withdraw = async (req, res) => {
  try {
    const { amount, privateKey } = req.body;
    
    // Validate inputs
    if (!amount || amount <= 0 || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input parameters'
      });
    }
    
    // Perform withdrawal
    const result = await blockchainService.withdraw(privateKey, amount);
    
    // Return result
    res.status(200).json({
      success: true,
      transaction: result
    });
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process withdrawal'
    });
  }
};

exports.withdrawToMpesa = async (req, res) => {
  try {
    const { phoneNumber, amount, privateKey, userId } = req.body;
    
    // Validate inputs
    if (!phoneNumber || !amount || amount <= 0 || !privateKey || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input parameters'
      });
    }
    
    // First withdraw from contract
    const withdrawResult = await blockchainService.withdraw(privateKey, amount);
    
    // Create transaction record
    const transaction = await Transaction.create({
      userId,
      type: 'mpesa_withdrawal',
      status: 'processing',
      amount,
      txHash: withdrawResult.txHash,
      timestamp: Date.now()
    });
    
    // In a real implementation, we would now:
    // 1. Convert USDC to KES via an exchange
    // 2. Initiate M-Pesa payout to user
    
    // Simulate M-Pesa payout
    const mpesaResponse = await mpesaService.initiateWithdrawal(
      phoneNumber,
      amount * 150, // Simulate KES conversion (1 USDC = 150 KES)
      `BazuuSave Withdrawal #${transaction._id}`
    );
    
    // Update transaction with M-Pesa reference
    await Transaction.findByIdAndUpdate(
      transaction._id,
      {
        mpesaReference: mpesaResponse.ConversationID,
        status: 'completed'
      }
    );
    
    // Return result
    res.status(200).json({
      success: true,
      message: 'Withdrawal initiated',
      transactionId: transaction._id
    });
  } catch (error) {
    console.error('Error processing M-Pesa withdrawal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process M-Pesa withdrawal'
    });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 10, page = 1 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const transactions = await Transaction.find({
      $or: [
        { userAddress: address.toLowerCase() },
        { walletAddress: address.toLowerCase() }
      ]
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    const total = await Transaction.countDocuments({
      $or: [
        { userAddress: address.toLowerCase() },
        { walletAddress: address.toLowerCase() }
      ]
    });
    
    res.status(200).json({
      success: true,
      transactions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions'
    });
  }
};