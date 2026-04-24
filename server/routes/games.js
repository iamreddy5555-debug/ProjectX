const express = require('express');
const GameBet = require('../models/GameBet');
const User = require('../models/User');
const AdminControl = require('../models/AdminControl');
const gameRounds = require('../services/gameRounds');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Per-game stake limits. Users can use preset tiers OR any custom integer
// amount within [min, max]. Tiers are just UI shortcuts.
const GAME_LIMITS = {
  color:    { min: 10, max: 10000 },
  coinflip: { min: 20, max: 10000 },
  aviator:  { min: 10, max: 10000 },
  ludo:     { min: 10, max: 10000 },
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

// Place a bet on the CURRENT shared color round. Only valid during betting phase.
router.post('/color', auth, async (req, res) => {
  try {
    const { selection, stake } = req.body;
    if (!selection) return res.status(400).json({ message: 'Selection required' });
    const allowed = ['red', 'green', 'violet', 'big', 'small', '0','1','2','3','4','5','6','7','8','9'];
    if (!allowed.includes(selection)) return res.status(400).json({ message: 'Invalid selection' });

    const cur = gameRounds.getState('color');
    if (!cur.roundId || cur.phase !== 'betting') {
      return res.status(400).json({ message: 'Betting is closed — wait for next round' });
    }
    if (new Date(cur.bettingEndsAt).getTime() <= Date.now()) {
      return res.status(400).json({ message: 'Betting window just closed' });
    }

    const user = await getUserChecked(req.user.id, stake, 'color');
    user.balance -= stake;
    await user.save();

    const bet = await GameBet.create({
      userId: user._id,
      gameType: 'color',
      selection,
      stake,
      roundId: cur.roundId,
      status: 'pending',
    });

    res.json({ betId: bet._id, roundId: cur.roundId, newBalance: user.balance });
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message || 'Server error' });
  }
});

// Get current color round state (phase, seconds left, last results)
router.get('/color/current', (req, res) => {
  res.json(gameRounds.getState('color'));
});

router.get('/color/my-bets', auth, async (req, res) => {
  try {
    const cur = gameRounds.getState('color');
    if (!cur.roundId) return res.json([]);
    const bets = await GameBet.find({
      userId: req.user.id, gameType: 'color', roundId: cur.roundId,
    });
    res.json(bets);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
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

// ===== COIN FLIP (shared 90s rounds) =====
router.post('/coinflip', auth, async (req, res) => {
  try {
    const { selection, stake } = req.body;
    if (!['heads', 'tails'].includes(selection)) {
      return res.status(400).json({ message: 'Selection must be heads or tails' });
    }

    const cur = gameRounds.getState('coinflip');
    if (!cur.roundId || cur.phase !== 'betting') {
      return res.status(400).json({ message: 'Betting is closed — wait for next round' });
    }
    if (new Date(cur.bettingEndsAt).getTime() <= Date.now()) {
      return res.status(400).json({ message: 'Betting window just closed' });
    }

    const user = await getUserChecked(req.user.id, stake, 'coinflip');
    user.balance -= stake;
    await user.save();

    const bet = await GameBet.create({
      userId: user._id,
      gameType: 'coinflip',
      selection,
      stake,
      roundId: cur.roundId,
      status: 'pending',
    });

    res.json({ betId: bet._id, roundId: cur.roundId, newBalance: user.balance });
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message || 'Server error' });
  }
});

router.get('/coinflip/current', (req, res) => {
  res.json(gameRounds.getState('coinflip'));
});

router.get('/coinflip/my-bets', auth, async (req, res) => {
  try {
    const cur = gameRounds.getState('coinflip');
    if (!cur.roundId) return res.json([]);
    const bets = await GameBet.find({
      userId: req.user.id, gameType: 'coinflip', roundId: cur.roundId,
    });
    res.json(bets);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== LUDO DICE RACE =====
// User bets on one of 4 colors (red/blue/green/yellow). Server picks
// the winner (random, or forced by admin), returns it plus an animation
// script of dice rolls so the client can run a 4-pawn race visually.
// Payout: 3.6× on win (4 colors, 10% house edge).
const LUDO_COLORS = ['red', 'blue', 'green', 'yellow'];
const LUDO_PAYOUT = 3.6;
const LUDO_TRACK_LENGTH = 50;

const generateLudoRace = (winner, forcedDice = {}) => {
  // Produce a sequence of turns; each turn rolls a die for each color.
  // At the end, the chosen winner must be the first to reach TRACK_LENGTH.
  // forcedDice: { red?: 1-6, blue?: 1-6, green?: 1-6, yellow?: 1-6 } — those
  // colors roll that exact value every turn instead of random.
  const positions = { red: 0, blue: 0, green: 0, yellow: 0 };
  const rolls = [];
  let safety = 60;

  const rollForColor = (c) => {
    if (forcedDice[c] && forcedDice[c] >= 1 && forcedDice[c] <= 6) {
      return forcedDice[c];
    }
    // Winner gets a slightly better dice distribution so it finishes first
    const max = c === winner ? 6 : 5;
    const min = c === winner ? 2 : 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  while (positions[winner] < LUDO_TRACK_LENGTH && safety-- > 0) {
    const turn = {};
    for (const c of LUDO_COLORS) {
      let roll = rollForColor(c);
      // Don't let non-winners overtake the winner
      const next = positions[c] + roll;
      if (c !== winner && next >= LUDO_TRACK_LENGTH) {
        roll = Math.max(1, LUDO_TRACK_LENGTH - 1 - positions[c]);
      }
      turn[c] = roll;
      positions[c] += roll;
    }
    rolls.push(turn);
  }

  // Snap winner to finish
  positions[winner] = LUDO_TRACK_LENGTH;
  return { rolls, finalPositions: positions };
};

// Place a bet on the current shared Ludo race during its betting window.
router.post('/ludo', auth, async (req, res) => {
  try {
    const { selection, stake } = req.body;
    if (!LUDO_COLORS.includes(selection)) {
      return res.status(400).json({ message: `Pick one of: ${LUDO_COLORS.join(', ')}` });
    }

    const cur = gameRounds.getState('ludo');
    if (!cur.roundId || cur.phase !== 'betting') {
      return res.status(400).json({ message: 'Betting is closed — wait for next race' });
    }
    if (new Date(cur.bettingEndsAt).getTime() <= Date.now()) {
      return res.status(400).json({ message: 'Betting window just closed' });
    }

    const user = await getUserChecked(req.user.id, stake, 'ludo');
    user.balance -= stake;
    await user.save();

    const bet = await GameBet.create({
      userId: user._id,
      gameType: 'ludo',
      selection,
      stake,
      roundId: cur.roundId,
      status: 'pending',
    });

    res.json({ betId: bet._id, roundId: cur.roundId, newBalance: user.balance });
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message || 'Server error' });
  }
});

router.get('/ludo/current', (req, res) => {
  res.json(gameRounds.getState('ludo'));
});

router.get('/ludo/my-bets', auth, async (req, res) => {
  try {
    const cur = gameRounds.getState('ludo');
    if (!cur.roundId) return res.json([]);
    const bets = await GameBet.find({
      userId: req.user.id, gameType: 'ludo', roundId: cur.roundId,
    });
    res.json(bets);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Recent Ludo winners for history
router.get('/ludo/recent', async (req, res) => {
  try {
    const bets = await GameBet.find({ gameType: 'ludo', status: 'settled' })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('outcome createdAt');
    res.json(bets.map(b => ({ winner: b.outcome, at: b.createdAt })));
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
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

// Join the current shared aviator flight by placing a bet during the
// betting window. Cash out during the flight to lock in the multiplier.
router.post('/aviator/start', auth, async (req, res) => {
  try {
    const { stake } = req.body;
    const cur = gameRounds.getState('aviator');
    if (!cur.roundId || cur.phase !== 'waiting') {
      return res.status(400).json({ message: 'Plane is already flying — wait for next round' });
    }
    if (new Date(cur.bettingEndsAt).getTime() <= Date.now()) {
      return res.status(400).json({ message: 'Betting just closed' });
    }

    const user = await getUserChecked(req.user.id, stake, 'aviator');

    // Prevent double-betting same round
    const already = await GameBet.findOne({
      userId: user._id, gameType: 'aviator', roundId: cur.roundId, status: 'pending',
    });
    if (already) return res.status(400).json({ message: 'You already bet on this round' });

    user.balance -= stake;
    await user.save();

    const bet = await GameBet.create({
      userId: user._id,
      gameType: 'aviator',
      selection: 'aviator',
      stake,
      status: 'pending',
      roundId: cur.roundId,
      startedAt: new Date(),
    });

    res.json({
      betId: bet._id,
      roundId: cur.roundId,
      bettingEndsAt: cur.bettingEndsAt,
      newBalance: user.balance,
    });
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

    // Check the current shared flight state
    const cur = gameRounds.getStateForSettle('aviator');
    if (cur.roundId !== bet.roundId) {
      return res.status(400).json({ message: 'Round already ended' });
    }
    if (cur.phase !== 'flying') {
      return res.status(400).json({ message: 'Plane is not flying yet' });
    }

    const elapsed = (Date.now() - new Date(cur.startedAt).getTime()) / 1000;
    const currentMul = Math.max(1, Math.pow(1.06, elapsed));
    // Safety check: if elapsed somehow exceeded crashPoint time, reject (should be caught by round settle)
    if (currentMul >= cur.crashPoint) {
      return res.status(400).json({ message: 'Too late — plane already crashed' });
    }

    const cappedMultiplier = Math.round(currentMul * 100) / 100;
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
      multiplier: cappedMultiplier,
      payout,
      newBalance: freshUser.balance,
    });
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message || 'Server error' });
  }
});

// Current shared flight state
router.get('/aviator/current', (req, res) => {
  res.json(gameRounds.getState('aviator'));
});

// Has the current user already bet on the current round?
router.get('/aviator/my-bet', auth, async (req, res) => {
  try {
    const cur = gameRounds.getState('aviator');
    if (!cur.roundId) return res.json({ bet: null });
    const bet = await GameBet.findOne({
      userId: req.user.id,
      gameType: 'aviator',
      roundId: cur.roundId,
    });
    res.json({ bet });
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
