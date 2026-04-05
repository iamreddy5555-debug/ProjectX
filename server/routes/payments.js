const express = require('express');
const multer = require('multer');
const path = require('path');
const Payment = require('../models/Payment');
const QRCode = require('../models/QRCode');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Multer config for screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/screenshots'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Get a random active QR code for deposit
router.get('/qr', auth, async (req, res) => {
  try {
    const qrCodes = await QRCode.find({ isActive: true });
    if (qrCodes.length === 0) {
      return res.status(404).json({ message: 'No active payment methods available' });
    }
    const randomQR = qrCodes[Math.floor(Math.random() * qrCodes.length)];
    res.json(randomQR);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit deposit request with screenshot
router.post('/deposit', auth, upload.single('screenshot'), async (req, res) => {
  try {
    const { amount, qrCodeId, utrNumber } = req.body;
    if (!amount || !req.file) {
      return res.status(400).json({ message: 'Amount and screenshot are required' });
    }
    const payment = new Payment({
      userId: req.user.id,
      type: 'deposit',
      amount: parseFloat(amount),
      qrCodeId: qrCodeId || undefined,
      screenshotUrl: `/uploads/screenshots/${req.file.filename}`,
      utrNumber: utrNumber || '',
      status: 'pending',
    });
    await payment.save();
    res.status(201).json({ message: 'Deposit request submitted', payment });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit withdrawal request
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount, withdrawMethod, accountNumber, ifscCode, accountHolder, bankName, withdrawUpiId } = req.body;
    if (!amount || amount < 100) {
      return res.status(400).json({ message: 'Minimum withdrawal is ₹100' });
    }
    if (!withdrawMethod) {
      return res.status(400).json({ message: 'Select a withdrawal method' });
    }
    if (withdrawMethod === 'bank') {
      if (!accountNumber || !ifscCode || !accountHolder) {
        return res.status(400).json({ message: 'Account number, IFSC code, and account holder name are required' });
      }
    } else if (withdrawMethod === 'upi') {
      if (!withdrawUpiId) {
        return res.status(400).json({ message: 'UPI ID is required' });
      }
    }

    const user = await User.findById(req.user.id);
    if (user.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    // Hold the amount
    user.balance -= amount;
    await user.save();

    const payment = new Payment({
      userId: req.user.id,
      type: 'withdrawal',
      amount,
      status: 'pending',
      withdrawMethod,
      accountNumber: accountNumber || '',
      ifscCode: ifscCode || '',
      accountHolder: accountHolder || '',
      bankName: bankName || '',
      withdrawUpiId: withdrawUpiId || '',
    });
    await payment.save();
    res.status(201).json({ message: 'Withdrawal request submitted', payment, newBalance: user.balance });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's payment history
router.get('/history', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
