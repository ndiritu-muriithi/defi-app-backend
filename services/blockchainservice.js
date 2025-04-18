/**
 * Blockchain Service
 * Manages interactions with the Base L2 blockchain via ethers.js
 * 
 * 
 */

const { ethers } = require('ethers');
const redis = require('../config/redis');
const Transaction = require('../models/transaction');
const Goal = require('../models/goal');
const User = require('../models/user');
const { 
  provider, 
  signer, 
  bazuuSaveContract, 
  bazuuSaveContractReadOnly, 
  usdcContract, 
  createTxOptions 
} = require('../config/blockchain');

// Cache durations
const CACHE_DURATION = {
  BALANCE: 300,          // 5 minutes
  EVENTS: 60,            // 1 minute
  TRANSACTION: 3600,     // 1 hour
  GOAL: 600              // 10 minutes
};

/**
 * Get user's USDC balance from contract
 * @param {string} walletAddress Ethereum wallet address
 * @returns {Promise<string>} Balance in USDC (formatted)
 */
const getBalance = async (walletAddress) => {
  try {
    // Try to get from cache first
    const cacheKey = `balance:${walletAddress.toLowerCase()}`;
    const cachedBalance = await redis.getCache(cacheKey);
    
    if (cachedBalance !== null) {
      return cachedBalance;
    }
    
    // Get from blockchain
    const balanceWei = await bazuuSaveContractReadOnly.getBalance(walletAddress);
    const balance = ethers.formatUnits(balanceWei, 6); // USDC has 6 decimals
    
    // Cache the result
    await redis.setCache(cacheKey, balance, CACHE_DURATION.BALANCE);
    
    return balance;
  } catch (error) {
    console.error(`Error getting balance for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Get user's wallet USDC balance
 * @param {string} walletAddress Ethereum wallet address
 * @returns {Promise<string>} Balance in USDC (formatted)
 */
const getWalletBalance = async (walletAddress) => {
  try {
    const balanceWei = await usdcContract.balanceOf(walletAddress);
    return ethers.formatUnits(balanceWei, 6); // USDC has 6 decimals
  } catch (error) {
    console.error(`Error getting wallet balance for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Check if user has approved enough USDC for a transaction
 * @param {string} walletAddress Ethereum wallet address
 * @param {string} amount Amount in USDC (formatted)
 * @returns {Promise<boolean>} Whether user has approved enough USDC
 */
const hasAllowance = async (walletAddress, amount) => {
  try {
    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    const allowance = await usdcContract.allowance(walletAddress, bazuuSaveContract.address);
    return allowance >= amountWei;
  } catch (error) {
    console.error(`Error checking allowance for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Approve USDC spending for the BazuuSave contract
 * @param {string} walletAddress Ethereum wallet address
 * @returns {Promise<Object>} Transaction receipt
 */
const approveUSDC = async (walletAddress) => {
  try {
    const maxAmount = ethers.MaxUint256; // Approve maximum amount
    const tx = await usdcContract.approve(bazuuSaveContract.address, maxAmount);
    return await tx.wait();
  } catch (error) {
    console.error(`Error approving USDC for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Deposit USDC into the BazuuSave contract
 * @param {string} walletAddress Ethereum wallet address
 * @param {string} amount Amount in USDC (formatted)
 * @returns {Promise<Object>} Transaction receipt
 */
const deposit = async (walletAddress, amount) => {
  try {
    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    const tx = await bazuuSaveContract.deposit(amountWei, createTxOptions());
    return await tx.wait();
  } catch (error) {
    console.error(`Error depositing USDC for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Withdraw USDC from the BazuuSave contract
 * @param {string} walletAddress Ethereum wallet address
 * @param {string} amount Amount in USDC (formatted)
 * @returns {Promise<Object>} Transaction receipt
 */
const withdraw = async (walletAddress, amount) => {
  try {
    const amountWei = ethers.parseUnits(amount, 6); // USDC has 6 decimals
    const tx = await bazuuSaveContract.withdraw(amountWei, createTxOptions());
    return await tx.wait();
  } catch (error) {
    console.error(`Error withdrawing USDC for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Create a goal on the blockchain
 * @param {string} walletAddress Ethereum wallet address
 * @param {string} goalId Goal ID
 * @param {string} targetAmount Target amount in USDC (formatted)
 * @param {number} deadline Unix timestamp for goal deadline
 * @returns {Promise<Object>} Transaction receipt
 */
const createGoalOnChain = async (walletAddress, goalId, targetAmount, deadline) => {
  try {
    const amountWei = ethers.parseUnits(targetAmount, 6); // USDC has 6 decimals
    const tx = await bazuuSaveContract.createGoal(goalId, amountWei, deadline, createTxOptions());
    return await tx.wait();
  } catch (error) {
    console.error(`Error creating goal on chain for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Complete a goal on the blockchain
 * @param {string} walletAddress Ethereum wallet address
 * @param {string} goalId Goal ID
 * @returns {Promise<Object>} Transaction receipt
 */
const completeGoalOnChain = async (walletAddress, goalId) => {
  try {
    const tx = await bazuuSaveContract.completeGoal(goalId, createTxOptions());
    return await tx.wait();
  } catch (error) {
    console.error(`Error completing goal on chain for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Get events from the blockchain
 * @param {string} walletAddress Optional wallet address to filter events
 * @param {number} fromBlock Optional starting block number
 * @param {number} toBlock Optional ending block number
 * @returns {Promise<Array>} Array of events
 */
const getEvents = async (walletAddress = null, fromBlock = null, toBlock = null) => {
  try {
    const filter = bazuuSaveContract.filters.Deposit();
    const events = await bazuuSaveContract.queryFilter(filter, fromBlock, toBlock);
    
    if (walletAddress) {
      return events.filter(event => event.args.user.toLowerCase() === walletAddress.toLowerCase());
    }
    
    return events;
  } catch (error) {
    console.error('Error getting events:', error);
    throw error;
  }
};

/**
 * Get transaction details from the blockchain
 * @param {string} txHash Transaction hash
 * @returns {Promise<Object>} Transaction details
 */
const getTransactionDetails = async (txHash) => {
  try {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: ethers.formatUnits(tx.value, 6), // USDC has 6 decimals
      gasPrice: ethers.formatUnits(tx.gasPrice, 'gwei'),
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? 'success' : 'failed',
      blockNumber: receipt.blockNumber,
      timestamp: (await provider.getBlock(receipt.blockNumber)).timestamp
    };
  } catch (error) {
    console.error(`Error getting transaction details for ${txHash}:`, error);
    throw error;
  }
};

/**
 * Sync transactions to database
 * @param {string} walletAddress Ethereum wallet address
 * @returns {Promise<void>}
 */
const syncTransactionsToDatabase = async (walletAddress) => {
  try {
    const events = await getEvents(walletAddress);
    
    for (const event of events) {
      const txHash = event.transactionHash;
      
      // Check if transaction already exists
      const existingTx = await Transaction.findOne({ hash: txHash });
      if (existingTx) continue;
      
      // Get transaction details
      const txDetails = await getTransactionDetails(txHash);
      
      // Create transaction record
      await Transaction.create({
        hash: txDetails.hash,
        from: txDetails.from,
        to: txDetails.to,
        value: txDetails.value,
        gasPrice: txDetails.gasPrice,
        gasUsed: txDetails.gasUsed,
        status: txDetails.status,
        blockNumber: txDetails.blockNumber,
        timestamp: new Date(txDetails.timestamp * 1000),
        userId: walletAddress
      });
    }
  } catch (error) {
    console.error(`Error syncing transactions for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Setup event listeners for the blockchain
 * @returns {Promise<void>}
 */
const setupEventListeners = async () => {
  try {
    // Listen for Deposit events
    bazuuSaveContract.on('Deposit', async (user, amount, event) => {
      console.log(`New deposit from ${user}: ${ethers.formatUnits(amount, 6)} USDC`);
      
      // Update user's balance in cache
      const cacheKey = `balance:${user.toLowerCase()}`;
      await redis.deleteCache(cacheKey);
      
      // Sync transaction to database
      await syncTransactionsToDatabase(user);
    });
    
    // Listen for Withdrawal events
    bazuuSaveContract.on('Withdrawal', async (user, amount, event) => {
      console.log(`New withdrawal from ${user}: ${ethers.formatUnits(amount, 6)} USDC`);
      
      // Update user's balance in cache
      const cacheKey = `balance:${user.toLowerCase()}`;
      await redis.deleteCache(cacheKey);
      
      // Sync transaction to database
      await syncTransactionsToDatabase(user);
    });
    
    // Listen for GoalCreated events
    bazuuSaveContract.on('GoalCreated', async (user, goalId, targetAmount, deadline, event) => {
      console.log(`New goal created by ${user}: ${goalId}`);
      
      // Update goal in cache
      const cacheKey = `goal:${goalId}`;
      await redis.deleteCache(cacheKey);
    });
    
    // Listen for GoalCompleted events
    bazuuSaveContract.on('GoalCompleted', async (user, goalId, event) => {
      console.log(`Goal completed by ${user}: ${goalId}`);
      
      // Update goal in cache
      const cacheKey = `goal:${goalId}`;
      await redis.deleteCache(cacheKey);
    });
    
    console.log('Blockchain event listeners setup complete');
  } catch (error) {
    console.error('Error setting up blockchain event listeners:', error);
    throw error;
  }
};

/**
 * Get blockchain health status
 * @returns {Promise<Object>} Health status
 */
const getBlockchainHealth = async () => {
  try {
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    
    return {
      status: 'healthy',
      blockNumber,
      network: network.name,
      chainId: network.chainId
    };
  } catch (error) {
    console.error('Error getting blockchain health:', error);
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

module.exports = {
  getBalance,
  getWalletBalance,
  hasAllowance,
  approveUSDC,
  deposit,
  withdraw,
  createGoalOnChain,
  completeGoalOnChain,
  getEvents,
  getTransactionDetails,
  syncTransactionsToDatabase,
  setupEventListeners,
  getBlockchainHealth
};