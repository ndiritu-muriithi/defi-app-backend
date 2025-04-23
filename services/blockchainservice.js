/**
 * Blockchain Service
 * Manages interactions with the Base L2 blockchain via ethers.js
 * 
 * 
 */

const { ethers } = require('ethers');
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

// In-memory cache
const cache = {
  balances: new Map(),
  events: new Map(),
  transactions: new Map(),
  goals: new Map()
};

// Cache durations in milliseconds
const CACHE_DURATION = {
  BALANCE: 300000,          // 5 minutes
  EVENTS: 60000,            // 1 minute
  TRANSACTION: 3600000,     // 1 hour
  GOAL: 600000              // 10 minutes
};

/**
 * Helper function to manage cache
 * @param {string} type - Cache type (BALANCE, EVENTS, etc.)
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not in cache
 * @returns {Promise<any>} Cached or fresh data
 */
const getCachedData = async (type, key, fetchFn) => {
  const now = Date.now();
  const cached = cache[type.toLowerCase()].get(key);
  
  if (cached && (now - cached.timestamp) < CACHE_DURATION[type]) {
    return cached.data;
  }
  
  const data = await fetchFn();
  cache[type.toLowerCase()].set(key, {
    data,
    timestamp: now
  });
  
  return data;
};

/**
 * Get user's balance from the smart contract
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<string>} User's balance in USDC
 */
const getBalance = async (walletAddress) => {
  try {
    // Try to get from cache first
    const cacheKey = `balance:${walletAddress.toLowerCase()}`;
    return await getCachedData('BALANCE', cacheKey, async () => {
      // Get from blockchain
      const balanceWei = await bazuuSaveContractReadOnly.getBalance(walletAddress);
      return ethers.formatUnits(balanceWei, 6); // USDC has 6 decimals
    });
  } catch (error) {
    console.error(`Error getting balance for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Get wallet's USDC balance
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<string>} USDC balance
 */
const getWalletBalance = async (walletAddress) => {
  try {
    const balanceWei = await usdcContract.balanceOf(walletAddress);
    return ethers.formatUnits(balanceWei, 6);
  } catch (error) {
    console.error(`Error getting wallet balance for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Check if user has approved USDC spending
 * @param {string} walletAddress - User's wallet address
 * @param {string} amount - Amount to check
 * @returns {Promise<boolean>} True if approved
 */
const hasAllowance = async (walletAddress, amount) => {
  try {
    const allowanceWei = await usdcContract.allowance(walletAddress, bazuuSaveContract.target);
    const allowance = ethers.formatUnits(allowanceWei, 6);
    return parseFloat(allowance) >= parseFloat(amount);
  } catch (error) {
    console.error(`Error checking allowance for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Approve USDC spending
 * @param {string} walletAddress - User's wallet address
 * @returns {Promise<ethers.TransactionResponse>} Transaction response
 */
const approveUSDC = async (walletAddress) => {
  try {
    const tx = await usdcContract.approve(
      bazuuSaveContract.target,
      ethers.MaxUint256,
      await createTxOptions(walletAddress)
    );
    return tx;
  } catch (error) {
    console.error(`Error approving USDC for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Deposit USDC into the smart contract
 * @param {string} walletAddress - User's wallet address
 * @param {string} amount - Amount to deposit
 * @returns {Promise<ethers.TransactionResponse>} Transaction response
 */
const deposit = async (walletAddress, amount) => {
  try {
    const amountWei = ethers.parseUnits(amount, 6);
    const tx = await bazuuSaveContract.deposit(
      amountWei,
      await createTxOptions(walletAddress)
    );
    
    // Update cache after successful deposit
    const cacheKey = `balance:${walletAddress.toLowerCase()}`;
    cache.balances.delete(cacheKey);
    
    return tx;
  } catch (error) {
    console.error(`Error depositing for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Withdraw USDC from the smart contract
 * @param {string} walletAddress - User's wallet address
 * @param {string} amount - Amount to withdraw
 * @returns {Promise<ethers.TransactionResponse>} Transaction response
 */
const withdraw = async (walletAddress, amount) => {
  try {
    const amountWei = ethers.parseUnits(amount, 6);
    const tx = await bazuuSaveContract.withdraw(
      amountWei,
      await createTxOptions(walletAddress)
    );
    
    // Update cache after successful withdrawal
    const cacheKey = `balance:${walletAddress.toLowerCase()}`;
    cache.balances.delete(cacheKey);
    
    return tx;
  } catch (error) {
    console.error(`Error withdrawing for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Create a savings goal on the blockchain
 * @param {string} walletAddress - User's wallet address
 * @param {string} goalId - Goal ID
 * @param {string} targetAmount - Target amount
 * @param {number} deadline - Unix timestamp
 * @returns {Promise<ethers.TransactionResponse>} Transaction response
 */
const createGoalOnChain = async (walletAddress, goalId, targetAmount, deadline) => {
  try {
    const targetAmountWei = ethers.parseUnits(targetAmount, 6);
    const tx = await bazuuSaveContract.createGoal(
      goalId,
      targetAmountWei,
      deadline,
      await createTxOptions(walletAddress)
    );
    
    // Update cache after successful goal creation
    const cacheKey = `goal:${goalId}`;
    cache.goals.delete(cacheKey);
    
    return tx;
  } catch (error) {
    console.error(`Error creating goal for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Complete a savings goal on the blockchain
 * @param {string} walletAddress - User's wallet address
 * @param {string} goalId - Goal ID
 * @returns {Promise<ethers.TransactionResponse>} Transaction response
 */
const completeGoalOnChain = async (walletAddress, goalId) => {
  try {
    const tx = await bazuuSaveContract.completeGoal(
      goalId,
      await createTxOptions(walletAddress)
    );
    
    // Update cache after successful goal completion
    const cacheKey = `goal:${goalId}`;
    cache.goals.delete(cacheKey);
    
    return tx;
  } catch (error) {
    console.error(`Error completing goal for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Get blockchain events
 * @param {string} walletAddress - Optional wallet address filter
 * @param {number} fromBlock - Optional start block
 * @param {number} toBlock - Optional end block
 * @returns {Promise<Array>} Array of events
 */
const getEvents = async (walletAddress = null, fromBlock = null, toBlock = null) => {
  try {
    const cacheKey = `events:${walletAddress || 'all'}:${fromBlock || 'latest'}:${toBlock || 'latest'}`;
    return await getCachedData('EVENTS', cacheKey, async () => {
      const filter = bazuuSaveContract.filters.Deposited();
      if (walletAddress) {
        filter.address = walletAddress;
      }
      return await bazuuSaveContract.queryFilter(filter, fromBlock, toBlock);
    });
  } catch (error) {
    console.error('Error getting events:', error);
    throw error;
  }
};

/**
 * Get transaction details
 * @param {string} txHash - Transaction hash
 * @returns {Promise<Object>} Transaction details
 */
const getTransactionDetails = async (txHash) => {
  try {
    const cacheKey = `transaction:${txHash}`;
    return await getCachedData('TRANSACTION', cacheKey, async () => {
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);
      return { ...tx, receipt };
    });
  } catch (error) {
    console.error(`Error getting transaction details for ${txHash}:`, error);
    throw error;
  }
};

/**
 * Sync transactions to database
 * @param {string} walletAddress - User's wallet address
 */
const syncTransactionsToDatabase = async (walletAddress) => {
  try {
    const events = await getEvents(walletAddress);
    for (const event of events) {
      const existingTx = await Transaction.findOne({ txHash: event.transactionHash });
      if (!existingTx) {
        const txDetails = await getTransactionDetails(event.transactionHash);
        await Transaction.create({
          txHash: event.transactionHash,
          walletAddress: walletAddress,
          type: event.event,
          amount: ethers.formatUnits(event.args.amount, 6),
          blockNumber: event.blockNumber,
          timestamp: (await provider.getBlock(event.blockNumber)).timestamp,
          status: txDetails.receipt.status === 1 ? 'success' : 'failed'
        });
      }
    }
  } catch (error) {
    console.error(`Error syncing transactions for ${walletAddress}:`, error);
    throw error;
  }
};

/**
 * Setup blockchain event listeners
 */
const setupEventListeners = async () => {
  try {
    // Listen for Deposit events
    bazuuSaveContract.on('Deposited', async (user, amount, event) => {
      console.log(`New deposit: ${user} - ${ethers.formatUnits(amount, 6)} USDC`);
      
      // Update user's balance in cache
      const cacheKey = `balance:${user.toLowerCase()}`;
      cache.balances.delete(cacheKey);
      
      // Sync transaction to database
      await syncTransactionsToDatabase(user);
    });
    
    // Listen for Withdraw events
    bazuuSaveContract.on('Withdrawn', async (user, amount, event) => {
      console.log(`New withdrawal: ${user} - ${ethers.formatUnits(amount, 6)} USDC`);
      
      // Update user's balance in cache
      const cacheKey = `balance:${user.toLowerCase()}`;
      cache.balances.delete(cacheKey);
      
      // Sync transaction to database
      await syncTransactionsToDatabase(user);
    });
    
    console.log('Blockchain event listeners setup complete');
  } catch (error) {
    console.error('Error setting up event listeners:', error);
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