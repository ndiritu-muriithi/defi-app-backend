const express = require('express');
const savingsController = require('../controllers/savingsController');
const { auth } = require('../middleware/auth');
const { standard, transaction } = require('../middleware/ratelimiter');
const router = express.Router();

// Get balance
router.get('/balance/:address', standard, savingsController.getBalance);

// Deposit routes
router.post('/deposit/crypto', auth, transaction, savingsController.depositCrypto);
router.post('/deposit/mpesa', auth, transaction, savingsController.depositMpesa);
router.post('/mpesa/callback', savingsController.mpesaCallback);

// Withdrawal routes
router.post('/withdraw/crypto', auth, transaction, savingsController.withdraw);
router.post('/withdraw/mpesa', auth, transaction, savingsController.withdrawToMpesa);

// Transaction history
router.get('/transactions/:address', auth, standard, savingsController.getTransactions);

module.exports = router;