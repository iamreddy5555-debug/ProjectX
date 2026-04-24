// Shared live-round scheduler. Runs three game loops continuously so every
// connected client sees the same state at the same time.
//   - Color:    30s rounds (25s betting + 5s reveal)
//   - Coinflip: 90s rounds (80s betting + 10s reveal)
//   - Aviator:  continuous — 6s betting window, then flight, then 4s pause
//
// Bets are tied to a roundId. When a round settles, all pending bets for
// that round are resolved at once.

const GameRound = require('../models/GameRound');
const GameBet = require('../models/GameBet');
const User = require('../models/User');
const AdminControl = require('../models/AdminControl');

// -------- Color helpers --------
const colorsOfNumber = (n) => {
  if (n === 0) return ['red', 'violet'];
  if (n === 5) return ['green', 'violet'];
  if ([2, 4, 6, 8].includes(n)) return ['red'];
  return ['green'];
};

// -------- Aviator helpers --------
const generateCrashPoint = () => {
  const r = Math.random();
  return Math.max(1.0, Math.min(50, Math.round((0.99 / (1 - r)) * 100) / 100));
};

const newRoundId = (gameType) =>
  `${gameType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// In-memory state (broadcast to clients + used by /current endpoints)
const state = {
  color:    { roundId: null, phase: 'betting', bettingEndsAt: null, revealAt: null, result: null, lastResults: [] },
  coinflip: { roundId: null, phase: 'betting', bettingEndsAt: null, revealAt: null, result: null, lastResults: [] },
  aviator:  { roundId: null, phase: 'waiting', startedAt: null, bettingEndsAt: null, crashPoint: null, lastCrashes: [] },
};

let ioRef = null;

const broadcast = (event, payload) => {
  if (ioRef) ioRef.emit(event, payload);
};

// ============ COLOR (WinGo 30s) ============
const COLOR_BET_MS = 25_000;   // 25s betting
const COLOR_REVEAL_MS = 5_000; // 5s reveal

const startColorRound = async () => {
  const now = Date.now();
  const roundId = newRoundId('color');
  const bettingEndsAt = new Date(now + COLOR_BET_MS);
  const revealAt = new Date(now + COLOR_BET_MS + COLOR_REVEAL_MS);

  await GameRound.create({
    gameType: 'color', roundId, phase: 'betting',
    startedAt: new Date(now), bettingEndsAt, revealAt,
  });

  state.color = {
    ...state.color,
    roundId, phase: 'betting',
    bettingEndsAt: bettingEndsAt.toISOString(),
    revealAt: revealAt.toISOString(),
    result: null,
  };
  broadcast('color:round', state.color);

  setTimeout(() => revealColorRound(roundId), COLOR_BET_MS);
};

const revealColorRound = async (roundId) => {
  // Determine result (admin override wins)
  const control = await AdminControl.getSingleton();
  let number;
  if (typeof control.nextColorRoll === 'number') {
    number = control.nextColorRoll;
    if (control.nextColorMode === 'oneshot') {
      control.nextColorRoll = null;
      await control.save();
    }
  } else {
    number = Math.floor(Math.random() * 10);
  }
  const colors = colorsOfNumber(number);
  const result = { number, colors };

  await GameRound.findOneAndUpdate(
    { roundId },
    { phase: 'revealing', result, settledAt: new Date() }
  );

  state.color = {
    ...state.color,
    phase: 'revealing',
    result,
    lastResults: [{ number, colors, at: new Date().toISOString() }, ...state.color.lastResults].slice(0, 20),
  };
  broadcast('color:round', state.color);
  broadcast('color:result', { roundId, number, colors });

  // Settle all pending bets for this round
  await settleColorBets(roundId, number, colors);

  setTimeout(startColorRound, COLOR_REVEAL_MS);
};

const settleColorBets = async (roundId, number, colors) => {
  const pending = await GameBet.find({ gameType: 'color', roundId, status: 'pending' });
  for (const bet of pending) {
    let multiplier = 0;
    const sel = bet.selection;
    if (/^[0-9]$/.test(sel)) {
      if (parseInt(sel, 10) === number) multiplier = 9;
    } else if (sel === 'red') {
      if (number === 0) multiplier = 1.5;
      else if (colors.includes('red')) multiplier = 2;
    } else if (sel === 'green') {
      if (number === 5) multiplier = 1.5;
      else if (colors.includes('green')) multiplier = 2;
    } else if (sel === 'violet') {
      if (colors.includes('violet')) multiplier = 4.5;
    } else if (sel === 'big') {
      if (number >= 5) multiplier = 2;
    } else if (sel === 'small') {
      if (number <= 4) multiplier = 2;
    }
    const payout = Math.round(bet.stake * multiplier * 100) / 100;
    bet.status = 'settled';
    bet.outcome = `${number}:${colors.join('+')}`;
    bet.multiplier = multiplier;
    bet.payout = payout;
    bet.won = multiplier > 0;
    await bet.save();
    if (bet.won) await User.findByIdAndUpdate(bet.userId, { $inc: { balance: payout } });
  }
};

// ============ COIN FLIP (90s) ============
const COIN_BET_MS = 80_000;
const COIN_REVEAL_MS = 10_000;

const startCoinflipRound = async () => {
  const now = Date.now();
  const roundId = newRoundId('coinflip');
  const bettingEndsAt = new Date(now + COIN_BET_MS);
  const revealAt = new Date(now + COIN_BET_MS + COIN_REVEAL_MS);

  await GameRound.create({
    gameType: 'coinflip', roundId, phase: 'betting',
    startedAt: new Date(now), bettingEndsAt, revealAt,
  });

  state.coinflip = {
    ...state.coinflip,
    roundId, phase: 'betting',
    bettingEndsAt: bettingEndsAt.toISOString(),
    revealAt: revealAt.toISOString(),
    result: null,
  };
  broadcast('coinflip:round', state.coinflip);

  setTimeout(() => revealCoinflipRound(roundId), COIN_BET_MS);
};

const revealCoinflipRound = async (roundId) => {
  const control = await AdminControl.getSingleton();
  let outcome;
  if (control.nextCoinflipOutcome) {
    outcome = control.nextCoinflipOutcome;
    if (control.nextCoinflipMode === 'oneshot') {
      control.nextCoinflipOutcome = null;
      await control.save();
    }
  } else {
    outcome = Math.random() < 0.5 ? 'heads' : 'tails';
  }

  await GameRound.findOneAndUpdate(
    { roundId },
    { phase: 'revealing', result: outcome, settledAt: new Date() }
  );

  state.coinflip = {
    ...state.coinflip,
    phase: 'revealing',
    result: outcome,
    lastResults: [{ outcome, at: new Date().toISOString() }, ...state.coinflip.lastResults].slice(0, 20),
  };
  broadcast('coinflip:round', state.coinflip);
  broadcast('coinflip:result', { roundId, outcome });

  const pending = await GameBet.find({ gameType: 'coinflip', roundId, status: 'pending' });
  for (const bet of pending) {
    const won = bet.selection === outcome;
    bet.status = 'settled';
    bet.outcome = outcome;
    bet.multiplier = won ? 2 : 0;
    bet.payout = won ? bet.stake * 2 : 0;
    bet.won = won;
    await bet.save();
    if (won) await User.findByIdAndUpdate(bet.userId, { $inc: { balance: bet.payout } });
  }

  setTimeout(startCoinflipRound, COIN_REVEAL_MS);
};

// ============ AVIATOR (continuous) ============
const AVIATOR_BET_MS = 7_000;    // 7s betting window
const AVIATOR_PAUSE_MS = 4_000;  // 4s after crash before next betting

const startAviatorBetting = async () => {
  const control = await AdminControl.getSingleton();
  let crashPoint;
  if (typeof control.nextAviatorCrash === 'number') {
    crashPoint = control.nextAviatorCrash;
    if (control.nextAviatorMode === 'oneshot') {
      control.nextAviatorCrash = null;
      await control.save();
    }
  } else {
    crashPoint = generateCrashPoint();
  }

  const now = Date.now();
  const roundId = newRoundId('aviator');
  const bettingEndsAt = new Date(now + AVIATOR_BET_MS);

  await GameRound.create({
    gameType: 'aviator', roundId, phase: 'betting',
    startedAt: new Date(now), bettingEndsAt, crashPoint,
  });

  state.aviator = {
    ...state.aviator,
    roundId, phase: 'waiting',
    bettingEndsAt: bettingEndsAt.toISOString(),
    startedAt: null,
    crashPoint, // server-only — we'll strip before broadcasting
  };
  broadcast('aviator:state', publicAviatorState());

  setTimeout(() => startAviatorFlight(roundId, crashPoint), AVIATOR_BET_MS);
};

const startAviatorFlight = async (roundId, crashPoint) => {
  const now = Date.now();
  await GameRound.findOneAndUpdate({ roundId }, { phase: 'flying', startedAt: new Date(now) });
  state.aviator = { ...state.aviator, phase: 'flying', startedAt: new Date(now).toISOString() };
  broadcast('aviator:state', publicAviatorState());

  // multiplier = 1.06^tSec; compute when it reaches crashPoint
  // tCrash (sec) = ln(crashPoint) / ln(1.06)
  const tCrashMs = Math.max(200, Math.ceil(Math.log(crashPoint) / Math.log(1.06) * 1000));
  setTimeout(() => crashAviator(roundId, crashPoint), tCrashMs);
};

const crashAviator = async (roundId, crashPoint) => {
  await GameRound.findOneAndUpdate(
    { roundId },
    { phase: 'revealing', result: crashPoint, settledAt: new Date() }
  );

  state.aviator = {
    ...state.aviator,
    phase: 'crashed',
    crashPoint,
    lastCrashes: [{ crashPoint, at: new Date().toISOString() }, ...state.aviator.lastCrashes].slice(0, 20),
  };
  broadcast('aviator:state', publicAviatorState());

  // Settle remaining pending bets as losses (they didn't cash out in time)
  const pending = await GameBet.find({ gameType: 'aviator', roundId, status: 'pending' });
  for (const bet of pending) {
    bet.status = 'settled';
    bet.outcome = 'crashed';
    bet.multiplier = crashPoint;
    bet.payout = 0;
    bet.won = false;
    await bet.save();
  }

  setTimeout(startAviatorBetting, AVIATOR_PAUSE_MS);
};

// Strip crashPoint before broadcast unless crashed (so clients can't peek)
const publicAviatorState = () => {
  const s = state.aviator;
  if (s.phase === 'crashed') {
    return { ...s }; // reveal crashPoint only after crash
  }
  return { ...s, crashPoint: undefined };
};

// ============ Public state getters ============
const getState = (gameType) => {
  if (gameType === 'aviator') return publicAviatorState();
  return state[gameType];
};

const getStateForSettle = (gameType) => state[gameType];

const startAll = (io) => {
  ioRef = io;
  startColorRound().catch(e => console.error('color loop error', e));
  startCoinflipRound().catch(e => console.error('coinflip loop error', e));
  startAviatorBetting().catch(e => console.error('aviator loop error', e));
  console.log('🎰 Live game round scheduler started (color 30s, coinflip 90s, aviator continuous)');
};

module.exports = {
  startAll,
  getState,
  getStateForSettle,
};
