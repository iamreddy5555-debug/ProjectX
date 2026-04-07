const express = require('express');
const Bet = require('../models/Bet');
const Match = require('../models/Match');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Place a bet
router.post('/', auth, async (req, res) => {
  try {
    const { matchId, selection, stake } = req.body;
    if (!matchId || !selection || !stake) {
      return res.status(400).json({ message: 'matchId, selection and stake are required' });
    }
    if (!['teamA', 'teamB', 'draw'].includes(selection)) {
      return res.status(400).json({ message: 'Invalid selection' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.banned) return res.status(403).json({ message: 'Account suspended' });
    if (user.balance < stake) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }
    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    if (match.status === 'completed') {
      return res.status(400).json({ message: 'Match already completed' });
    }
    if (match.status === 'live' || new Date(match.startTime) <= new Date()) {
      return res.status(400).json({ message: 'Match has started — betting is closed' });
    }

    // Server-side authoritative payout — uses admin-controlled multiplier
    const multiplier = match.winMultiplier || 2.0;
    const potentialWin = parseFloat((stake * (multiplier - 1)).toFixed(2));

    // Deduct stake from balance
    user.balance -= stake;
    await user.save();

    const bet = new Bet({
      userId: req.user.id,
      matchId,
      selection,
      betType: 'back',
      odds: multiplier,
      stake,
      potentialWin,
    });
    await bet.save();

    res.status(201).json({ bet, newBalance: user.balance });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's bets
router.get('/my', auth, async (req, res) => {
  try {
    const bets = await Bet.find({ userId: req.user.id })
      .populate('matchId', 'title teamA teamB startTime status')
      .sort({ createdAt: -1 });
    res.json(bets);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
