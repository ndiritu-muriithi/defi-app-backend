// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BazuuSave is Ownable, ReentrancyGuard {
    // USDC token contract
    IERC20 public usdcToken;
    
    // Goal structure
    struct Goal {
        uint256 id;
        address owner;
        string name;
        uint256 targetAmount;
        uint256 currentAmount;
        uint256 deadline;
        bool completed;
    }
    
    // User balances
    mapping(address => uint256) public userBalances;
    
    // User goals
    mapping(address => mapping(uint256 => Goal)) public userGoals;
    mapping(address => uint256) public userGoalCounts;
    
    // Events
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event GoalCreated(address indexed user, uint256 goalId, string name, uint256 targetAmount);
    event GoalContributed(address indexed user, uint256 goalId, uint256 amount);
    event GoalCompleted(address indexed user, uint256 goalId);
    
    constructor(address _usdcToken) {
        usdcToken = IERC20(_usdcToken);
    }
    
    // Deposit USDC to savings
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than zero");
        
        // Transfer USDC from user to contract
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        // Update user balance
        userBalances[msg.sender] += amount;
        
        // Emit event
        emit Deposited(msg.sender, amount);
    }
    
    // Withdraw USDC from savings
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than zero");
        require(userBalances[msg.sender] >= amount, "Insufficient balance");
        
        // Update user balance before transfer to prevent reentrancy
        userBalances[msg.sender] -= amount;
        
        // Transfer USDC from contract to user
        require(usdcToken.transfer(msg.sender, amount), "Transfer failed");
        
        // Emit event
        emit Withdrawn(msg.sender, amount);
    }
    
    // Create a saving goal
    function createGoal(string calldata name, uint256 targetAmount, uint256 durationInDays) external {
        require(targetAmount > 0, "Target amount must be greater than zero");
        
        // Calculate deadline timestamp
        uint256 deadline = block.timestamp + (durationInDays * 1 days);
        
        // Get next goal ID for user
        uint256 goalId = userGoalCounts[msg.sender];
        
        // Create new goal
        userGoals[msg.sender][goalId] = Goal({
            id: goalId,
            owner: msg.sender,
            name: name,
            targetAmount: targetAmount,
            currentAmount: 0,
            deadline: deadline,
            completed: false
        });
        
        // Increment user's goal count
        userGoalCounts[msg.sender]++;
        
        // Emit event
        emit GoalCreated(msg.sender, goalId, name, targetAmount);
    }
    
    // Contribute to a goal
    function contributeToGoal(uint256 goalId, uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        require(userBalances[msg.sender] >= amount, "Insufficient balance");
        
        Goal storage goal = userGoals[msg.sender][goalId];
        require(goal.owner == msg.sender, "Goal not found");
        require(!goal.completed, "Goal already completed");
        
        // Update user balance and goal amount
        userBalances[msg.sender] -= amount;
        goal.currentAmount += amount;
        
        // Check if goal is completed
        if (goal.currentAmount >= goal.targetAmount) {
            goal.completed = true;
            emit GoalCompleted(msg.sender, goalId);
        }
        
        // Emit contribution event
        emit GoalContributed(msg.sender, goalId, amount);
    }
    
    // Get user balance
    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }
    
    // Get goal details
    function getGoal(address user, uint256 goalId) external view returns (Goal memory) {
        return userGoals[user][goalId];
    }
    
    // Get user's goal count
    function getGoalCount(address user) external view returns (uint256) {
        return userGoalCounts[user];
    }
    
    // Emergency withdrawal by owner (for contract migration)
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = usdcToken.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(usdcToken.transfer(owner(), balance), "Transfer failed");
    }
}