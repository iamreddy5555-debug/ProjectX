const express = require('express');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const Match = require('../models/Match');
const Contest = require('../models/Contest');
const FantasyTeam = require('../models/FantasyTeam');
const Payment = require('../models/Payment');
const Bet = require('../models/Bet');
const QRCode = require('../models/QRCode');
const ChatMessage = require('../models/ChatMessage');
const { adminAuth } = require('../middleware/auth');
const router = express.Router();

// QR upload config
const qrStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/qrcodes')),
  filename: (req, file, cb) => cb(null, `qr-${Date.now()}${path.extname(file.originalname)}`)
});
const qrUpload = multer({ storage: qrStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// ===== DASHBOARD STATS =====
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [totalUsers, pendingPayments, activeContests, totalDeposits, totalTeams] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Payment.countDocuments({ status: 'pending' }),
      Contest.countDocuments({ status: 'open' }),
      Payment.aggregate([
        { $match: { type: 'deposit', status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      FantasyTeam.countDocuments(),
    ]);
    res.json({
      totalUsers,
      pendingPayments,
      activeContests,
      totalDeposits: totalDeposits[0]?.total || 0,
      totalTeams,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== USERS =====
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/users/:id/balance', adminAuth, async (req, res) => {
  try {
    const { balance } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { balance }, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/users/:id/ban', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.banned = !user.banned;
    await user.save();
    res.json({ banned: user.banned });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== MATCHES =====
router.get('/matches', adminAuth, async (req, res) => {
  try {
    const matches = await Match.find().sort({ startTime: -1 });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/matches', adminAuth, async (req, res) => {
  try {
    const match = new Match({ ...req.body, isCustom: true });
    await match.save();
    res.status(201).json(match);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/matches/:id', adminAuth, async (req, res) => {
  try {
    const match = await Match.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/matches/:id', adminAuth, async (req, res) => {
  try {
    await Match.findByIdAndDelete(req.params.id);
    res.json({ message: 'Match deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== PAYMENTS =====
router.get('/payments', adminAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const payments = await Payment.find(filter).populate('userId', 'name email phone').sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/payments/:id/approve', adminAuth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(400).json({ message: 'Payment already processed' });

    payment.status = 'approved';
    payment.processedBy = req.user.id;
    payment.processedAt = new Date();
    payment.adminNote = req.body?.adminNote || '';
    await payment.save();

    if (payment.type === 'deposit') {
      await User.findByIdAndUpdate(payment.userId, { $inc: { balance: payment.amount } });
    }

    res.json({ message: 'Payment approved', payment });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/payments/:id/reject', adminAuth, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(400).json({ message: 'Payment already processed' });

    payment.status = 'rejected';
    payment.processedBy = req.user.id;
    payment.processedAt = new Date();
    payment.adminNote = req.body?.adminNote || '';
    await payment.save();

    // Refund if withdrawal was rejected
    if (payment.type === 'withdrawal') {
      await User.findByIdAndUpdate(payment.userId, { $inc: { balance: payment.amount } });
    }

    res.json({ message: 'Payment rejected', payment });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== QR CODES =====
router.get('/qrcodes', adminAuth, async (req, res) => {
  try {
    const qrcodes = await QRCode.find().sort({ createdAt: -1 });
    res.json(qrcodes);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/qrcodes', adminAuth, qrUpload.single('qrImage'), async (req, res) => {
  try {
    const { upiId, label } = req.body;
    if (!upiId || !req.file) {
      return res.status(400).json({ message: 'UPI ID and QR image are required' });
    }
    const qrCode = new QRCode({
      imageUrl: `/uploads/qrcodes/${req.file.filename}`,
      upiId,
      label: label || 'Payment QR',
    });
    await qrCode.save();
    res.status(201).json(qrCode);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/qrcodes/:id/toggle', adminAuth, async (req, res) => {
  try {
    const qr = await QRCode.findById(req.params.id);
    qr.isActive = !qr.isActive;
    await qr.save();
    res.json(qr);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/qrcodes/:id', adminAuth, async (req, res) => {
  try {
    await QRCode.findByIdAndDelete(req.params.id);
    res.json({ message: 'QR Code deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== CONTESTS =====
router.get('/contests', adminAuth, async (req, res) => {
  try {
    const contests = await Contest.find()
      .populate('matchId', 'title teamA teamB')
      .populate('teams.userId', 'name email')
      .sort({ createdAt: -1 });
    res.json(contests);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/contests', adminAuth, async (req, res) => {
  try {
    const contest = new Contest(req.body);
    await contest.save();
    res.status(201).json(contest);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/contests/:id', adminAuth, async (req, res) => {
  try {
    await Contest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Contest deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== BETS =====
router.get('/bets', adminAuth, async (req, res) => {
  try {
    const bets = await Bet.find()
      .populate('userId', 'name email')
      .populate('matchId', 'title teamA teamB')
      .sort({ createdAt: -1 });
    res.json(bets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/bets/:id/settle', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['won', 'lost', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const bet = await Bet.findById(req.params.id);
    if (!bet) return res.status(404).json({ message: 'Bet not found' });
    if (bet.status !== 'pending') return res.status(400).json({ message: 'Bet already settled' });

    bet.status = status;
    bet.settledAt = new Date();
    await bet.save();

    // If won, credit user balance with stake + potential win
    if (status === 'won') {
      await User.findByIdAndUpdate(bet.userId, { $inc: { balance: bet.stake + bet.potentialWin } });
    }
    // If cancelled, refund stake
    if (status === 'cancelled') {
      await User.findByIdAndUpdate(bet.userId, { $inc: { balance: bet.stake } });
    }

    res.json({ message: `Bet ${status}`, bet });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== CHAT =====
router.get('/chats', adminAuth, async (req, res) => {
  try {
    // Get unique users who have sent messages
    const userIds = await ChatMessage.distinct('senderId', { senderRole: 'user' });
    const users = await User.find({ _id: { $in: userIds } }).select('name email phone');
    
    const chats = await Promise.all(users.map(async (user) => {
      const lastMessage = await ChatMessage.findOne({
        $or: [{ senderId: user._id }, { receiverId: user._id }]
      }).sort({ createdAt: -1 });
      const unreadCount = await ChatMessage.countDocuments({
        senderId: user._id, senderRole: 'user', read: false
      });
      return { user, lastMessage, unreadCount };
    }));
    
    res.json(chats.sort((a, b) => (b.lastMessage?.createdAt || 0) - (a.lastMessage?.createdAt || 0)));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/chats/:userId', adminAuth, async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      $or: [
        { senderId: req.params.userId },
        { receiverId: req.params.userId }
      ]
    }).sort({ createdAt: 1 });
    // Mark as read
    await ChatMessage.updateMany(
      { senderId: req.params.userId, senderRole: 'user', read: false },
      { read: true }
    );
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/chats/:userId', adminAuth, async (req, res) => {
  try {
    const msg = new ChatMessage({
      senderId: req.user.id,
      receiverId: req.params.userId,
      message: req.body.message,
      senderRole: 'admin',
    });
    await msg.save();
    res.status(201).json(msg);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
