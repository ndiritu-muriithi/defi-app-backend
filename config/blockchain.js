/**
 * Blockchain Configuration
 * Handles connections to Base L2 blockchain via ethers.js
 */
const { ethers } = require('ethers');
const BazuuSaveABI = require('../contracts/BazuuSave.json').abi;
require('dotenv').config();

// Environment variables for blockchain configuration
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://base-sepolia.g.alchemy.com/v2/Jk-Hl9K5MhwP0Hj7Mbb9rVAneQnk9Asi';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x38A757586055C9aC18C650Ea68EEfAaFEe935C6a';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Create provider based on the Base L2 RPC URL
const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

// Create signer from private key (for transactions that need signing)
let signer;
try {
  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not defined in environment variables');
  }
  if (PRIVATE_KEY === 'your_private_key') {
    throw new Error('Please replace the placeholder private key in your .env file with your actual private key');
  }
  // Add 0x prefix if not present
  const formattedPrivateKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
  signer = new ethers.Wallet(formattedPrivateKey, provider);
} catch (error) {
  console.error('Error creating signer:', error.message);
  console.log('Running in read-only mode. Some features may be limited.');
  signer = null;
}

// Create contract instance
const bazuuSaveContract = new ethers.Contract(
  CONTRACT_ADDRESS,
  BazuuSaveABI,
  signer || provider
);

// Read-only contract instance (for queries that don't need signing)
const bazuuSaveContractReadOnly = new ethers.Contract(
  CONTRACT_ADDRESS,
  BazuuSaveABI,
  provider
);

// USDC contract configuration (Base L2)
const USDC_ADDRESS = process.env.USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_ABI = [
  // ERC20 standard functions
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

// USDC contract instance
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer || provider);

// Configure gas settings
const gasSettings = {
  maxFeePerGas: null,  // Will be populated at runtime based on network conditions
  maxPriorityFeePerGas: null,  // Will be populated at runtime based on network conditions
  gasLimit: 300000  // Default gas limit, can be overridden in specific transactions
};

// Function to get current gas prices
const getGasPrices = async () => {
  try {
    const feeData = await provider.getFeeData();
    return {
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    };
  } catch (error) {
    console.error('Error fetching gas prices:', error);
    return {
      maxFeePerGas: ethers.parseUnits('0.1', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('0.1', 'gwei')
    };
  }
};

// Function to create transaction options with current gas prices
const createTxOptions = async (overrides = {}) => {
  const gasPrices = await getGasPrices();
  return {
    ...gasSettings,
    maxFeePerGas: gasPrices.maxFeePerGas,
    maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
    ...overrides
  };
};

module.exports = {
  provider,
  signer,
  bazuuSaveContract,
  bazuuSaveContractReadOnly,
  usdcContract,
  USDC_ADDRESS,
  createTxOptions,
  getGasPrices
};