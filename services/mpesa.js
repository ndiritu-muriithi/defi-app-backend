const axios = require('axios');
const config = require('../config/env');

class MpesaService {
  constructor() {
    this.baseUrl = config.MPESA_API_URL;
    this.consumerKey = config.MPESA_CONSUMER_KEY;
    this.consumerSecret = config.MPESA_CONSUMER_SECRET;
    this.shortCode = config.MPESA_SHORT_CODE;
    this.passKey = config.MPESA_PASSKEY;
    this.callbackUrl = config.MPESA_CALLBACK_URL;
  }
  
  // Generate access token
  async getAccessToken() {
    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });
      
      return response.data.access_token;
    } catch (error) {
      console.error('Error getting Mpesa access token:', error);
      throw error;
    }
  }
  
  // Initiate STK push for deposit
  async initiateDeposit(phoneNumber, amount, accountRef) {
    try {
      const accessToken = await this.getAccessToken();
      
      // Format phone number and generate timestamp
      phoneNumber = phoneNumber.replace(/^0/, '254'); // Convert 07... to 254...
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);
      const password = Buffer.from(
        `${this.shortCode}${this.passKey}${timestamp}`
      ).toString('base64');
      
      // Make STK push request
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.shortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phoneNumber,
          PartyB: this.shortCode,
          PhoneNumber: phoneNumber,
          CallBackURL: `${this.callbackUrl}/api/mpesa/callback`,
          AccountReference: accountRef || 'BazuuSave',
          TransactionDesc: 'Deposit to BazuuSave'
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error initiating Mpesa deposit:', error);
      throw error;
    }
  }
  
  // B2C payment for withdrawal to mobile money
  async initiateWithdrawal(phoneNumber, amount, remark) {
    try {
      const accessToken = await this.getAccessToken();
      
      // Format phone number
      phoneNumber = phoneNumber.replace(/^0/, '254');
      
      // Create withdrawal request
      const response = await axios.post(
        `${this.baseUrl}/mpesa/b2c/v1/paymentrequest`,
        {
          InitiatorName: config.MPESA_INITIATOR_NAME,
          SecurityCredential: config.MPESA_SECURITY_CREDENTIAL,
          CommandID: 'BusinessPayment',
          Amount: amount,
          PartyA: this.shortCode,
          PartyB: phoneNumber,
          Remarks: remark || 'Withdrawal from BazuuSave',
          QueueTimeOutURL: `${this.callbackUrl}/api/mpesa/timeout`,
          ResultURL: `${this.callbackUrl}/api/mpesa/result`,
          Occasion: ''
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error initiating Mpesa withdrawal:', error);
      throw error;
    }
  }
  
  // Query transaction status
  async queryTransactionStatus(transactionId) {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);
      const password = Buffer.from(
        `${this.shortCode}${this.passKey}${timestamp}`
      ).toString('base64');
      
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: this.shortCode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: transactionId
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error querying transaction status:', error);
      throw error;
    }
  }
}

module.exports = new MpesaService();