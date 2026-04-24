const express = require('express');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const Match = require('../models/Match');
const Contest = require('../models/Contest');
const FantasyTeam = require('../models/FantasyTeam');
const Payment = require('../models/Payment');
const Bet = require('../models/Bet');
const GameBet = require('../models/GameBet');
const AdminControl = require('../models/AdminControl');
const QRCode = require('../models/QRCode');
const ChatMessage = require('../models/ChatMessage');
const { adminAuth } = require('../middleware/auth');
const router = express.Router();

// QR upload — store in memory, save as base64 data URL in DB (survives Render redeploys)
const qrUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ===== RESEED PLAYERS =====
router.post('/reseed', adminAuth, async (req, res) => {
  try {
    const cricbuzz = require('../services/cricbuzz');
    const ok = await cricbuzz.seedIPLData();
    const Player = require('../models/Player');
    const Match = require('../models/Match');
    const playerCount = await Player.countDocuments();
    const matchCount = await Match.countDocuments();
    res.json({
      success: ok,
      players: playerCount,
      matches: matchCount,
      message: ok ? 'Reseeded successfully' : 'Reseed failed',
    });
  } catch (error) {
    console.error('Reseed error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    // Store image as base64 data URL in DB — survives Render redeploys
    const mimeType = req.file.mimetype || 'image/png';
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const qrCode = new QRCode({
      imageUrl: dataUrl,
      upiId,
      label: label || 'Payment QR',
    });
    await qrCode.save();
    res.status(201).json(qrCode);
  } catch (error) {
    console.error('QR upload error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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

// ===== GAMES: STATS + CONTROL =====

// Per-game aggregate stats + top users by stake
router.get('/games/stats', adminAuth, async (req, res) => {
  try {
    const byGame = await GameBet.aggregate([
      { $match: { status: 'settled' } },
      { $group: {
          _id: '$gameType',
          bets: { $sum: 1 },
          totalStake: { $sum: '$stake' },
          totalPayout: { $sum: '$payout' },
          wins: { $sum: { $cond: ['$won', 1, 0] } },
      } },
    ]);

    // House P/L = totalStake - totalPayout
    const summary = {};
    for (const row of byGame) {
      summary[row._id] = {
        bets: row.bets,
        totalStake: row.totalStake,
        totalPayout: row.totalPayout,
        housePL: row.totalStake - row.totalPayout,
        wins: row.wins,
        winRate: row.bets > 0 ? +(row.wins / row.bets * 100).toFixed(2) : 0,
      };
    }

    // Top 10 users by stake volume per game
    const perGameUsers = {};
    for (const gt of ['color', 'coinflip', 'aviator']) {
      const top = await GameBet.aggregate([
        { $match: { gameType: gt, status: 'settled' } },
        { $group: {
            _id: '$userId',
            bets: { $sum: 1 },
            totalStake: { $sum: '$stake' },
            totalPayout: { $sum: '$payout' },
        } },
        { $sort: { totalStake: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: {
            _id: 0,
            userId: '$_id',
            name: '$user.name',
            email: '$user.email',
            phone: '$user.phone',
            bets: 1,
            totalStake: 1,
            totalPayout: 1,
            housePL: { $subtract: ['$totalStake', '$totalPayout'] },
        } },
      ]);
      perGameUsers[gt] = top;
    }

    res.json({ summary, topUsers: perGameUsers });
  } catch (err) {
    console.error('games/stats', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Paginated bet list per game
router.get('/games/bets', adminAuth, async (req, res) => {
  try {
    const { game, limit = 50 } = req.query;
    const filter = game ? { gameType: game } : {};
    const bets = await GameBet.find(filter)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit, 10) || 50, 200));
    res.json(bets);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current control overrides
router.get('/control', adminAuth, async (req, res) => {
  try {
    const ctl = await AdminControl.getSingleton();
    res.json(ctl);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update control overrides
router.patch('/control', adminAuth, async (req, res) => {
  try {
    const { nextColorRoll, nextColorMode, nextAviatorCrash, nextAviatorMode } = req.body;
    const ctl = await AdminControl.getSingleton();

    if (nextColorRoll === 'clear' || nextColorRoll === null) {
      ctl.nextColorRoll = null;
    } else if (typeof nextColorRoll === 'number' && nextColorRoll >= 0 && nextColorRoll <= 9) {
      ctl.nextColorRoll = Math.floor(nextColorRoll);
      ctl.nextColorSetBy = req.user.id;
      ctl.nextColorSetAt = new Date();
    }

    if (nextColorMode && ['oneshot', 'persistent'].includes(nextColorMode)) {
      ctl.nextColorMode = nextColorMode;
    }

    if (nextAviatorCrash === 'clear' || nextAviatorCrash === null) {
      ctl.nextAviatorCrash = null;
    } else if (typeof nextAviatorCrash === 'number' && nextAviatorCrash >= 1 && nextAviatorCrash <= 100) {
      ctl.nextAviatorCrash = Math.round(nextAviatorCrash * 100) / 100;
      ctl.nextAviatorSetBy = req.user.id;
      ctl.nextAviatorSetAt = new Date();
    }

    if (nextAviatorMode && ['oneshot', 'persistent'].includes(nextAviatorMode)) {
      ctl.nextAviatorMode = nextAviatorMode;
    }

    await ctl.save();
    res.json(ctl);
  } catch (err) {
    console.error('control patch', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
