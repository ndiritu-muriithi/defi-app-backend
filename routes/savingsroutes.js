const express = require('express');
const savingsController = require('../controllers/savingsController');
const auth = require('../middleware/auth');
const router = express.Router();

// Get balance
router.get('/balance/:address', savingsController.getBalance);

// Deposit routes
router.post('/deposit/crypto', auth, savingsController.depositCrypto);
router.post('/deposit/mpesa', auth, savingsController.depositMpesa);
router.post('/mpesa/callback', savingsController.mpesaCallback);

// Withdrawal routes
router.post('/withdraw/crypto', auth, savingsController.withdraw);
router.post('/withdraw/mpesa', auth, savingsController.withdrawToMpesa);

// Transaction history
router.get('/transactions/:address', auth, savingsController.getTransactions);

module.exports = router;