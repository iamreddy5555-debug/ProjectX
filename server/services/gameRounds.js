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
  ludo: {
    roundId: null,
    phase: 'betting',              // betting | racing | revealing
    bettingEndsAt: null,
    positions: { red: 0, blue: 0, green: 0, yellow: 0 },
    lastRoll: { red: 0, blue: 0, green: 0, yellow: 0 },
    turnNumber: 0,
    winner: null,
    lastResults: [],               // [{ winner, at }]
  },
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

// ============ LUDO (shared rounds) ============
// Flow:  10s betting → racing (turns every 800ms) → 3s result → next round
const LUDO_COLORS = ['red', 'blue', 'green', 'yellow'];
const LUDO_BET_MS = 10_000;
const LUDO_TURN_MS = 800;
const LUDO_RESULT_MS = 4_000;
const LUDO_TRACK = 50;
const LUDO_PAYOUT = 3.6;

const startLudoRound = async () => {
  const now = Date.now();
  const roundId = newRoundId('ludo');
  const bettingEndsAt = new Date(now + LUDO_BET_MS);

  await GameRound.create({
    gameType: 'ludo', roundId, phase: 'betting',
    startedAt: new Date(now), bettingEndsAt,
  });

  state.ludo = {
    ...state.ludo,
    roundId, phase: 'betting',
    bettingEndsAt: bettingEndsAt.toISOString(),
    positions: { red: 0, blue: 0, green: 0, yellow: 0 },
    lastRoll: { red: 0, blue: 0, green: 0, yellow: 0 },
    turnNumber: 0,
    winner: null,
  };
  broadcast('ludo:round', state.ludo);

  setTimeout(() => startLudoRacing(roundId), LUDO_BET_MS);
};

const startLudoRacing = async (roundId) => {
  // Pick the forced winner (if admin set one) up front so we can bias ties.
  // Dice overrides are re-read every turn so admin can change them live.
  const initialControl = await AdminControl.getSingleton();
  let forcedWinner = null;
  if (initialControl.nextLudoWinner && LUDO_COLORS.includes(initialControl.nextLudoWinner)) {
    forcedWinner = initialControl.nextLudoWinner;
    if (initialControl.nextLudoMode === 'oneshot') {
      initialControl.nextLudoWinner = null;
      await initialControl.save();
    }
  }

  state.ludo = { ...state.ludo, phase: 'racing', turnNumber: 0 };
  broadcast('ludo:round', state.ludo);

  const runTurn = async () => {
    const st = state.ludo;
    if (!st || st.roundId !== roundId) return; // round changed

    // Re-read control each turn so admin can inject dice mid-race
    const control = await AdminControl.getSingleton();
    const forcedDice = (control.nextLudoDice || {});

    const roll = {};
    const newPositions = { ...st.positions };
    for (const c of LUDO_COLORS) {
      let v;
      const forced = forcedDice[c];
      if (typeof forced === 'number' && forced >= 1 && forced <= 6) {
        v = forced;
      } else if (forcedWinner === c) {
        // Bias winner slightly higher (2-6) so it finishes first in absence of dice overrides
        v = Math.floor(Math.random() * 5) + 2;
      } else if (forcedWinner && c !== forcedWinner) {
        // Slow down non-winners slightly
        v = Math.floor(Math.random() * 5) + 1;
      } else {
        v = Math.floor(Math.random() * 6) + 1;
      }
      // Don't let non-forced-winners leapfrog the forced winner
      if (forcedWinner && c !== forcedWinner) {
        const next = newPositions[c] + v;
        if (next >= LUDO_TRACK) v = Math.max(1, LUDO_TRACK - 1 - newPositions[c]);
      }
      roll[c] = v;
      newPositions[c] = Math.min(LUDO_TRACK, newPositions[c] + v);
    }

    // Check for winner: first to reach LUDO_TRACK
    const reached = LUDO_COLORS.filter(c => newPositions[c] >= LUDO_TRACK);
    let winner = null;
    if (reached.length > 0) {
      if (forcedWinner && reached.includes(forcedWinner)) winner = forcedWinner;
      else winner = reached[0];
    }

    state.ludo = {
      ...state.ludo,
      positions: newPositions,
      lastRoll: roll,
      turnNumber: st.turnNumber + 1,
      winner,
      phase: winner ? 'revealing' : 'racing',
    };
    broadcast('ludo:turn', {
      roundId, turnNumber: state.ludo.turnNumber,
      roll, positions: newPositions, winner,
    });

    if (winner) {
      // Clear one-shot dice overrides
      if (control.nextLudoMode === 'oneshot') {
        let anyCleared = false;
        for (const c of LUDO_COLORS) {
          if (control.nextLudoDice?.[c]) {
            control.nextLudoDice[c] = null;
            anyCleared = true;
          }
        }
        if (anyCleared) {
          control.markModified('nextLudoDice');
          await control.save();
        }
      }
      await GameRound.findOneAndUpdate(
        { roundId },
        { phase: 'revealing', result: winner, settledAt: new Date() }
      );
      state.ludo = {
        ...state.ludo,
        lastResults: [{ winner, at: new Date().toISOString() }, ...state.ludo.lastResults].slice(0, 20),
      };
      broadcast('ludo:round', state.ludo);

      // Settle all pending bets for this round
      const pending = await GameBet.find({ gameType: 'ludo', roundId, status: 'pending' });
      for (const bet of pending) {
        const won = bet.selection === winner;
        bet.status = 'settled';
        bet.outcome = winner;
        bet.multiplier = won ? LUDO_PAYOUT : 0;
        bet.payout = won ? Math.round(bet.stake * LUDO_PAYOUT * 100) / 100 : 0;
        bet.won = won;
        await bet.save();
        if (won) await User.findByIdAndUpdate(bet.userId, { $inc: { balance: bet.payout } });
      }

      setTimeout(startLudoRound, LUDO_RESULT_MS);
    } else {
      setTimeout(runTurn, LUDO_TURN_MS);
    }
  };

  setTimeout(runTurn, 400); // small breath before first turn
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
  startLudoRound().catch(e => console.error('ludo loop error', e));
  console.log('🎰 Live round scheduler started (color 30s, coinflip 90s, aviator continuous, ludo ~15s)');
};

module.exports = {
  startAll,
  getState,
  getStateForSettle,
};
