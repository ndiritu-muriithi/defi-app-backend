const { ethers } = require('ethers');
const { AlphaRouter } = require('@uniswap/smart-order-router');
const { Token, CurrencyAmount, TradeType, Percent } = require('@uniswap/sdk-core');
const { Pool } = require('@uniswap/v3-sdk');
const config = require('../config/blockchain');
const IUniswapV3PoolABI = require('@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json').abi;
const IERC20ABI = require('../contracts/IERC20.json').abi;

class UniswapService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.router = new AlphaRouter({ chainId: config.chainId, provider: this.provider });
    
    // USDC token on Base
    this.USDC = new Token(
      config.chainId,
      config.usdcAddress,
      6,
      'USDC',
      'USD Coin'
    );
    
    // ETH token on Base
    this.WETH = new Token(
      config.chainId,
      config.wethAddress, 
      18,
      'WETH',
      'Wrapped Ether'
    );
  }
  
  // Swap tokens to USDC
  async swapToUSDC(privateKey, tokenAddress, amountIn) {
    try {
      // Create wallet
      const wallet = new ethers.Wallet(privateKey, this.provider);
      
      // Get token information
      const tokenContract = new ethers.Contract(tokenAddress, IERC20ABI, this.provider);
      const tokenDecimals = await tokenContract.decimals();
      const tokenSymbol = await tokenContract.symbol();
      const tokenName = await tokenContract.name();
      
      // Create token instance
      const inputToken = new Token(
        config.chainId,
        tokenAddress,
        tokenDecimals,
        tokenSymbol,
        tokenName
      );
      
      // Create currency amount for input token
      const wei = ethers.parseUnits(amountIn.toString(), tokenDecimals);
      const currencyAmount = CurrencyAmount.fromRawAmount(
        inputToken,
        wei.toString()
      );
      
      // Generate swap route
      const route = await this.router.route(
        currencyAmount,
        this.USDC,
        TradeType.EXACT_INPUT,
        {
          recipient: wallet.address,
          slippageTolerance: new Percent(5, 100), // 5% slippage
          deadline: Math.floor(Date.now() / 1000) + 1800 // 30 minute deadline
        }
      );
      
      // Get approval for token spending
      const approvalAmount = ethers.MaxUint256;
      const approvalTx = await tokenContract.connect(wallet).approve(
        route.methodParameters.to, // Router address
        approvalAmount
      );
      await approvalTx.wait();
      
      // Build transaction
      const transaction = {
        data: route.methodParameters.calldata,
        to: route.methodParameters.to,
        value: route.methodParameters.value,
        from: wallet.address,
        gasPrice: route.gasPriceWei,
        gasLimit: ethers.hexlify(1000000) // Hardcoded gas limit for simplicity
      };
      
      // Send transaction
      const tx = await wallet.sendTransaction(transaction);
      const receipt = await tx.wait();
      
      return {
        inputAmount: amountIn,
        outputAmount: ethers.formatUnits(route.quote.toFixed(), 6),
        txHash: receipt.hash
      };
    } catch (error) {
      console.error('Error swapping to USDC:', error);
      throw error;
    }
  }
  
  // Check current price of token in USDC
  async getTokenPriceInUSDC(tokenAddress) {
    try {
      // Get token contract
      const tokenContract = new ethers.Contract(tokenAddress, IERC20ABI, this.provider);
      const tokenDecimals = await tokenContract.decimals();
      
      // Find the pool address for token/USDC
      const poolAddress = await this.getPoolAddress(tokenAddress, config.usdcAddress, 3000); // 0.3% fee tier
      
      if (!poolAddress) {
        throw new Error('Pool not found');
      }
      
      // Get pool contract
      const poolContract = new ethers.Contract(poolAddress, IUniswapV3PoolABI, this.provider);
      
      // Get pool slot0 data
      const slot0 = await poolContract.slot0();
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      
      // Calculate price from sqrtPriceX96
      const token0 = await poolContract.token0();
      let price;
      
      if (token0.toLowerCase() === tokenAddress.toLowerCase()) {
        // If token is token0, price = 1/sqrtPrice^2
        price = 1 / (Number(sqrtPriceX96) ** 2 / 2 ** 192);
      } else {
        // If token is token1, price = sqrtPrice^2
        price = (Number(sqrtPriceX96) ** 2) / (2 ** 192);
      }
      
      // Adjust for decimals difference
      const decimalAdjustment = 10 ** (tokenDecimals - 6); // USDC has 6 decimals
      price = price / decimalAdjustment;
      
      return price;
    } catch (error) {
      console.error('Error getting token price:', error);
      throw error;
    }
  }
  
  // Helper function to get pool address
  async getPoolAddress(token0, token1, fee) {
    // This is a simplified version - in production we would use the Uniswap Factory
    // to find the pool address
    
    // For demo, return hardcoded pool address based on tokens
    if (
      (token0.toLowerCase() === config.wethAddress.toLowerCase() && 
       token1.toLowerCase() === config.usdcAddress.toLowerCase()) ||
      (token0.toLowerCase() === config.usdcAddress.toLowerCase() && 
       token1.toLowerCase() === config.wethAddress.toLowerCase())
    ) {
      return config.ethUsdcPoolAddress;
    }
    
    // Other token pairs would be handled similarly
    return null;
  }
}

module.exports = new UniswapService();