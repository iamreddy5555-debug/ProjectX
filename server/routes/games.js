const express = require('express');
const GameBet = require('../models/GameBet');
const User = require('../models/User');
const AdminControl = require('../models/AdminControl');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Per-game stake limits. Users can use preset tiers OR any custom integer
// amount within [min, max]. Tiers are just UI shortcuts.
const GAME_LIMITS = {
  color:    { min: 10, max: 10000 },
  coinflip: { min: 20, max: 10000 },
  aviator:  { min: 10, max: 10000 },
};

// ===== Helpers =====
const getUserChecked = async (userId, stake, gameType) => {
  const limits = GAME_LIMITS[gameType];
  if (!limits) throw { code: 400, message: 'Unknown game type' };
  const amt = Number(stake);
  if (!Number.isFinite(amt) || !Number.isInteger(amt) || amt <= 0) {
    throw { code: 400, message: 'Stake must be a positive whole number' };
  }
  if (amt < limits.min) throw { code: 400, message: `Minimum stake is ₹${limits.min}` };
  if (amt > limits.max) throw { code: 400, message: `Maximum stake is ₹${limits.max}` };

  const user = await User.findById(userId);
  if (!user) throw { code: 404, message: 'User not found' };
  if (user.banned) throw { code: 403, message: 'Account suspended' };
  if (user.balance < amt) throw { code: 400, message: 'Insufficient balance' };
  return user;
};

const creditUser = async (userId, amount) => {
  if (amount > 0) await User.findByIdAndUpdate(userId, { $inc: { balance: amount } });
};

// ===== COLOR / NUMBER GAME (WinGo rules) =====
// Number colors (each ball can have primary + secondary):
//   0 → Red + Violet
//   5 → Green + Violet
//   2, 4, 6, 8 → Red
//   1, 3, 7, 9 → Green
//
// Payouts:
//   Red   → 2x on {2,4,6,8}, 1.5x on 0
//   Green → 2x on {1,3,7,9}, 1.5x on 5
//   Violet → 4.5x on {0, 5}
//   Big    → 2x on {5,6,7,8,9}
//   Small  → 2x on {0,1,2,3,4}
//   Exact number → 9x
const colorsOfNumber = (n) => {
  if (n === 0) return ['red', 'violet'];
  if (n === 5) return ['green', 'violet'];
  if ([2, 4, 6, 8].includes(n)) return ['red'];
  return ['green']; // 1, 3, 7, 9
};

const primaryColor = (n) => {
  if (n === 0) return 'red';       // displays red+violet, primary red
  if (n === 5) return 'green';     // displays green+violet, primary green
  if ([2, 4, 6, 8].includes(n)) return 'red';
  return 'green';
};

router.post('/color', auth, async (req, res) => {
  try {
    const { selection, stake } = req.body;
    if (!selection) return res.status(400).json({ message: 'Selection required' });
    const user = await getUserChecked(req.user.id, stake, 'color');

    user.balance -= stake;
    await user.save();

    // Check admin override for next roll
    const control = await AdminControl.getSingleton();
    let roll;
    if (control.nextColorRoll !== null && control.nextColorRoll !== undefined) {
      roll = control.nextColorRoll;
      if (control.nextColorMode === 'oneshot') {
        control.nextColorRoll = null;
        await control.save();
      }
    } else {
      roll = Math.floor(Math.random() * 10);
    }
    const colors = colorsOfNumber(roll);

    // Determine win
    let multiplier = 0;
    if (/^[0-9]$/.test(selection)) {
      if (parseInt(selection, 10) === roll) multiplier = 9;
    } else if (selection === 'red') {
      if (roll === 0) multiplier = 1.5;                 // red+violet → partial
      else if (colors.includes('red')) multiplier = 2;
    } else if (selection === 'green') {
      if (roll === 5) multiplier = 1.5;
      else if (colors.includes('green')) multiplier = 2;
    } else if (selection === 'violet') {
      if (colors.includes('violet')) multiplier = 4.5;
    } else if (selection === 'big') {
      if (roll >= 5) multiplier = 2;
    } else if (selection === 'small') {
      if (roll <= 4) multiplier = 2;
    } else {
      return res.status(400).json({ message: 'Invalid selection' });
    }

    const payout = Math.round(stake * multiplier * 100) / 100;
    const won = multiplier > 0;

    const bet = await GameBet.create({
      userId: user._id,
      gameType: 'color',
      selection,
      stake,
      outcome: `${roll}:${colors.join('+')}`,
      multiplier,
      payout,
      won,
    });

    if (won) await creditUser(user._id, payout);
    const freshUser = await User.findById(user._id).select('balance');

    res.json({
      roll,
      resultColor: primaryColor(roll),
      colors,
      won,
      multiplier,
      payout,
      bet,
      newBalance: freshUser.balance,
    });
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message || 'Server error' });
  }
});

// Recent color game results (last 20) — public history for the UI
router.get('/color/recent', async (req, res) => {
  try {
    const bets = await GameBet.find({ gameType: 'color', status: 'settled' })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('outcome createdAt');
    const results = bets.map(b => {
      const [numStr] = (b.outcome || '0').split(':');
      const n = parseInt(numStr, 10);
      return { number: n, colors: colorsOfNumber(n), at: b.createdAt };
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== COIN FLIP =====
// 2x payout on win
router.post('/coinflip', auth, async (req, res) => {
  try {
    const { selection, stake } = req.body;
    if (!['heads', 'tails'].includes(selection)) {
      return res.status(400).json({ message: 'Selection must be heads or tails' });
    }
    const user = await getUserChecked(req.user.id, stake, 'coinflip');

    user.balance -= stake;
    await user.save();

    const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = selection === outcome;
    const multiplier = won ? 2 : 0;
    const payout = won ? stake * 2 : 0;

    const bet = await GameBet.create({
      userId: user._id,
      gameType: 'coinflip',
      selection,
      stake,
      outcome,
      multiplier,
      payout,
      won,
    });

    if (won) await creditUser(user._id, payout);
    const freshUser = await User.findById(user._id).select('balance');

    res.json({ outcome, won, multiplier, payout, bet, newBalance: freshUser.balance });
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message || 'Server error' });
  }
});

// ===== AVIATOR / CRASH =====
// Flow:
//   1. POST /aviator/start — deducts stake, generates crashPoint, returns bet id
//   2. POST /aviator/cashout — settles at current multiplier (server-computed from elapsed time)
//
// Multiplier growth:  m(t) = 1 * 1.06^t   (t = seconds elapsed)
// Crash point distribution (1% house edge):
//   r in [0,1); crash = max(1.00, 0.99 / (1 - r)) capped at 50x
const aviatorMultiplierAt = (startedAt) => {
  const tSec = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.max(1, Math.pow(1.06, tSec));
};

const generateCrashPoint = () => {
  const r = Math.random();
  const raw = 0.99 / (1 - r);
  return Math.max(1.0, Math.min(50, Math.round(raw * 100) / 100));
};

router.post('/aviator/start', auth, async (req, res) => {
  try {
    const { stake } = req.body;
    const user = await getUserChecked(req.user.id, stake, 'aviator');

    user.balance -= stake;
    await user.save();

    // Check admin override for crash point
    const control = await AdminControl.getSingleton();
    let crashPoint;
    if (control.nextAviatorCrash !== null && control.nextAviatorCrash !== undefined) {
      crashPoint = control.nextAviatorCrash;
      if (control.nextAviatorMode === 'oneshot') {
        control.nextAviatorCrash = null;
        await control.save();
      }
    } else {
      crashPoint = generateCrashPoint();
    }

    const bet = await GameBet.create({
      userId: user._id,
      gameType: 'aviator',
      selection: 'aviator',
      stake,
      status: 'pending',
      crashPoint,
      startedAt: new Date(),
    });

    res.json({ betId: bet._id, startedAt: bet.startedAt, newBalance: user.balance });
    // NOTE: crashPoint is NOT returned to client — they must cash out blind
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message || 'Server error' });
  }
});

router.post('/aviator/cashout', auth, async (req, res) => {
  try {
    const { betId } = req.body;
    const bet = await GameBet.findById(betId);
    if (!bet || String(bet.userId) !== req.user.id) {
      return res.status(404).json({ message: 'Bet not found' });
    }
    if (bet.gameType !== 'aviator') return res.status(400).json({ message: 'Not an aviator bet' });
    if (bet.status !== 'pending') return res.status(400).json({ message: 'Bet already settled' });

    const currentMultiplier = aviatorMultiplierAt(bet.startedAt);
    const cappedMultiplier = Math.round(currentMultiplier * 100) / 100;

    if (cappedMultiplier >= bet.crashPoint) {
      // Crashed — user loses
      bet.status = 'settled';
      bet.outcome = 'crashed';
      bet.multiplier = bet.crashPoint;
      bet.payout = 0;
      bet.won = false;
      await bet.save();
      const freshUser = await User.findById(req.user.id).select('balance');
      return res.json({
        won: false,
        crashed: true,
        crashPoint: bet.crashPoint,
        multiplier: bet.crashPoint,
        payout: 0,
        newBalance: freshUser.balance,
      });
    }

    // Successful cashout
    const payout = Math.round(bet.stake * cappedMultiplier * 100) / 100;
    bet.status = 'settled';
    bet.outcome = 'cashout';
    bet.multiplier = cappedMultiplier;
    bet.payout = payout;
    bet.won = true;
    await bet.save();

    await creditUser(bet.userId, payout);
    const freshUser = await User.findById(req.user.id).select('balance');

    res.json({
      won: true,
      crashed: false,
      multiplier: cappedMultiplier,
      payout,
      crashPoint: bet.crashPoint,
      newBalance: freshUser.balance,
    });
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message || 'Server error' });
  }
});

// Check pending aviator bet (for page refresh resume)
router.get('/aviator/pending', auth, async (req, res) => {
  try {
    const bet = await GameBet.findOne({
      userId: req.user.id,
      gameType: 'aviator',
      status: 'pending',
    }).sort({ createdAt: -1 });
    if (!bet) return res.json({ pending: false });

    // If it's been too long (likely crashed already), auto-settle as crash
    const now = Date.now();
    const elapsed = (now - new Date(bet.startedAt).getTime()) / 1000;
    const mul = Math.pow(1.06, elapsed);
    if (mul >= bet.crashPoint) {
      bet.status = 'settled';
      bet.outcome = 'crashed';
      bet.multiplier = bet.crashPoint;
      bet.payout = 0;
      bet.won = false;
      await bet.save();
      return res.json({ pending: false, crashed: true, crashPoint: bet.crashPoint });
    }

    res.json({
      pending: true,
      betId: bet._id,
      stake: bet.stake,
      startedAt: bet.startedAt,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== HISTORY =====
// Last 20 settled aviator crash points across all users (public stats, no PII)
router.get('/aviator/crashes', async (req, res) => {
  try {
    const bets = await GameBet.find({ gameType: 'aviator', status: 'settled' })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('crashPoint createdAt');
    res.json(bets.map(b => ({ crashPoint: b.crashPoint, at: b.createdAt })));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const bets = await GameBet.find({ userId: req.user.id, status: 'settled' })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(bets);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
