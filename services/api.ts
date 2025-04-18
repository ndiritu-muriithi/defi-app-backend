import axios from 'axios';

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// User balance
export const getUserBalance = async (address: string) => {
  try {
    const response = await api.get(`/balance/${address}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw error;
  }
};

// User events
export const getUserEvents = async (address: string) => {
  try {
    const response = await api.get(`/events/${address}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
};

// User loan
export const getUserLoan = async (address: string) => {
  try {
    const response = await api.get(`/loan/${address}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching loan:', error);
    throw error;
  }
};

// Deposit funds
export const deposit = async (address: string, amount: string) => {
  try {
    const response = await api.post('/transactions/deposit', { address, amount });
    return response.data;
  } catch (error) {
    console.error('Error making deposit:', error);
    throw error;
  }
};

// Withdraw funds
export const withdraw = async (address: string) => {
  try {
    const response = await api.post('/transactions/withdraw', { address });
    return response.data;
  } catch (error) {
    console.error('Error making withdrawal:', error);
    throw error;
  }
};

// Request loan
export const requestLoan = async (address: string, amount: string) => {
  try {
    const response = await api.post('/loan/request', { address, amount });
    return response.data;
  } catch (error) {
    console.error('Error requesting loan:', error);
    throw error;
  }
};

// Repay loan
export const repayLoan = async (address: string) => {
  try {
    const response = await api.post('/loan/repay', { address });
    return response.data;
  } catch (error) {
    console.error('Error repaying loan:', error);
    throw error;
  }
};