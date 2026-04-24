// 4-player Ludo match service: matchmaking, turns, bots, admin dice control.
//
// Simplified Ludo rules:
//   - 4 players, 1 pawn each (Red, Blue, Green, Yellow)
//   - Board: linear 40-square perimeter track; 0 = base, 40 = finish
//   - Players take turns rolling 1-6
//   - 6 = extra turn (max 3 extras per turn to prevent loops)
//   - Roll of 6 required to exit base (position 0 → 1)
//   - Landing on another player's square captures them (back to 0)
//   - First pawn to reach 40 wins the pot
//   - Stake deducted on join; pot = stake × 4; winner gets 3.5× stake (12.5% house)

const LudoMatch = require('../models/LudoMatch');
const GameBet = require('../models/GameBet');
const User = require('../models/User');
const AdminControl = require('../models/AdminControl');
const crypto = require('crypto');

const TRACK = 40;
const MATCH_SIZE = 4;
const QUEUE_WAIT_MS = 15_000;       // wait 15s for real players before adding bots
const TURN_TIMEOUT_MS = 20_000;     // auto-skip after 20s
const BOT_ROLL_DELAY_MS = 1_200;
const COLORS = ['red', 'blue', 'green', 'yellow'];
const HOUSE_CUT = 0.125;

let ioRef = null;

// In-memory state: waiting queue + active rooms
const queue = [];                    // [{ userId, name, stake, socketId, queuedAt }]
const rooms = new Map();             // matchId -> room state
const userMatches = new Map();       // userId -> matchId (for lookup)
let queueTimer = null;

const newId = (prefix) =>
  `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

const broadcast = (matchId, event, payload) => {
  if (!ioRef) return;
  ioRef.to(`ludo-match:${matchId}`).emit(event, payload);
};

const publicState = (room) => ({
  matchId: room.matchId,
  phase: room.phase,
  players: room.players.map(p => ({
    userId: String(p.userId || ''),
    name: p.name,
    color: p.color,
    position: p.position,
    isBot: p.isBot,
    finishedAt: p.finishedAt || null,
  })),
  currentTurn: room.currentTurn,
  lastRoll: room.lastRoll,
  stake: room.stake,
  pot: room.pot,
  winner: room.winner,
  turnEndsAt: room.turnEndsAt,
});

// ===== Matchmaking =====
const ensureQueueTimer = () => {
  if (queueTimer || queue.length === 0) return;
  queueTimer = setTimeout(() => {
    queueTimer = null;
    fillAndStartRoom();
  }, QUEUE_WAIT_MS);
};

const fillAndStartRoom = async () => {
  if (queue.length === 0) return;

  // Pull the first eligible group (same stake)
  const firstStake = queue[0].stake;
  const sameStake = queue.filter(q => q.stake === firstStake).slice(0, MATCH_SIZE);
  if (sameStake.length === 0) return;

  // Remove them from queue
  for (const p of sameStake) {
    const idx = queue.findIndex(q => q.userId === p.userId);
    if (idx >= 0) queue.splice(idx, 1);
  }

  // Fill remaining seats with bots
  const botsNeeded = MATCH_SIZE - sameStake.length;
  const botNames = ['Bot-Raj', 'Bot-Amit', 'Bot-Priya', 'Bot-Neha'];
  for (let i = 0; i < botsNeeded; i++) {
    sameStake.push({
      userId: null,
      name: botNames[i],
      stake: firstStake,
      isBot: true,
    });
  }

  // Assign colors
  const shuffled = [...COLORS].sort(() => Math.random() - 0.5);
  const players = sameStake.map((p, i) => ({
    userId: p.userId || null,
    name: p.name,
    color: shuffled[i],
    position: 0,
    isBot: !!p.isBot,
    stake: firstStake,
    finishedAt: null,
  }));

  const matchId = newId('ludo-match');
  const pot = firstStake * MATCH_SIZE;

  // Persist match
  const doc = await LudoMatch.create({
    matchId,
    players,
    phase: 'playing',
    currentTurn: 0,
    stake: firstStake,
    pot,
    startedAt: new Date(),
  });

  // Create pending bets for each human player (used for stats + settle)
  for (const p of players.filter(x => x.userId)) {
    await GameBet.create({
      userId: p.userId,
      gameType: 'ludo-match',
      selection: p.color,
      stake: firstStake,
      status: 'pending',
      roundId: matchId,
    });
  }

  // Room in memory
  const room = {
    matchId,
    players,
    phase: 'playing',
    currentTurn: 0,
    lastRoll: 0,
    stake: firstStake,
    pot,
    winner: null,
    turnEndsAt: null,
    sixStreak: 0,
    turnTimeout: null,
  };
  rooms.set(matchId, room);

  // Map users to this match for lookup
  for (const p of players) {
    if (p.userId) userMatches.set(String(p.userId), matchId);
  }

  // Make each user's socket join the room (clients also join on their end, but this
  // handles the server-originated case) + broadcast initial state
  if (ioRef) {
    for (const p of sameStake) {
      if (p.socketId) {
        const s = ioRef.sockets.sockets.get(p.socketId);
        if (s) s.join(`ludo-match:${matchId}`);
      }
    }
  }
  broadcast(matchId, 'ludomatch:state', publicState(room));

  // Start first turn
  scheduleTurn(matchId);

  // If queue still has people (mismatched stakes remain), maybe start another room
  if (queue.length >= 1) ensureQueueTimer();
};

// ===== Turn engine =====
const scheduleTurn = (matchId) => {
  const room = rooms.get(matchId);
  if (!room || room.phase !== 'playing') return;

  const current = room.players[room.currentTurn];
  room.turnEndsAt = new Date(Date.now() + TURN_TIMEOUT_MS).toISOString();
  broadcast(matchId, 'ludomatch:state', publicState(room));

  // If current player is a bot, auto-roll shortly
  if (current.isBot) {
    if (room.turnTimeout) clearTimeout(room.turnTimeout);
    room.turnTimeout = setTimeout(() => doRoll(matchId, null, true), BOT_ROLL_DELAY_MS);
    return;
  }

  // Human: start turn timeout, auto-skip if they don't roll in time
  if (room.turnTimeout) clearTimeout(room.turnTimeout);
  room.turnTimeout = setTimeout(() => {
    // Auto-skip (no move, just advance turn)
    advanceTurn(matchId);
  }, TURN_TIMEOUT_MS);
};

const advanceTurn = (matchId) => {
  const room = rooms.get(matchId);
  if (!room) return;
  room.sixStreak = 0;
  room.currentTurn = (room.currentTurn + 1) % room.players.length;
  // Skip finished players
  let safety = 0;
  while (room.players[room.currentTurn].finishedAt && safety++ < 4) {
    room.currentTurn = (room.currentTurn + 1) % room.players.length;
  }
  scheduleTurn(matchId);
};

const doRoll = async (matchId, userId, fromBot = false) => {
  const room = rooms.get(matchId);
  if (!room || room.phase !== 'playing') return { ok: false, error: 'Match not active' };

  const current = room.players[room.currentTurn];
  if (!fromBot) {
    if (!current.userId || String(current.userId) !== String(userId)) {
      return { ok: false, error: 'Not your turn' };
    }
  }
  if (current.isBot && !fromBot) return { ok: false, error: 'Bot turn' };

  // Clear timeout
  if (room.turnTimeout) { clearTimeout(room.turnTimeout); room.turnTimeout = null; }

  // Consult admin override
  const control = await AdminControl.getSingleton();
  let roll;
  if (typeof control.nextLudoMatchDice === 'number') {
    roll = control.nextLudoMatchDice;
    if (control.nextLudoMatchMode === 'oneshot') {
      control.nextLudoMatchDice = null;
      await control.save();
    }
  } else {
    roll = Math.floor(Math.random() * 6) + 1;
  }
  room.lastRoll = roll;

  // Resolve move
  const pawn = current;
  let moved = false;
  if (pawn.position === 0) {
    // Must roll 6 to exit base
    if (roll === 6) {
      pawn.position = 1;
      moved = true;
    }
  } else {
    const next = pawn.position + roll;
    if (next <= TRACK) {
      // Check if landing square contains another pawn → capture
      for (const other of room.players) {
        if (other.color !== pawn.color && other.position === next && !other.finishedAt) {
          other.position = 0; // captured back to base
          broadcast(matchId, 'ludomatch:capture', { victim: other.color, by: pawn.color });
        }
      }
      pawn.position = next;
      moved = true;
      if (next === TRACK) {
        pawn.finishedAt = new Date();
      }
    }
    // else: overshoot, don't move
  }

  broadcast(matchId, 'ludomatch:roll', {
    color: pawn.color, roll, moved, position: pawn.position, finished: !!pawn.finishedAt,
  });
  broadcast(matchId, 'ludomatch:state', publicState(room));

  // Check win
  const winner = room.players.find(p => p.finishedAt);
  if (winner) {
    await settleMatch(matchId, winner);
    return { ok: true, roll, won: winner.color === pawn.color };
  }

  // Six gives extra turn (max 2 extras)
  if (roll === 6 && room.sixStreak < 2) {
    room.sixStreak = (room.sixStreak || 0) + 1;
    scheduleTurn(matchId);
  } else {
    advanceTurn(matchId);
  }

  return { ok: true, roll };
};

const settleMatch = async (matchId, winner) => {
  const room = rooms.get(matchId);
  if (!room) return;
  room.phase = 'finished';
  room.winner = winner.color;

  const winnerPayout = Math.floor(room.pot * (1 - HOUSE_CUT));

  // Update DB match
  await LudoMatch.findOneAndUpdate(
    { matchId },
    {
      phase: 'finished',
      winner: winner.color,
      winnerUserId: winner.userId || null,
      finishedAt: new Date(),
      players: room.players,
    }
  );

  // Settle bets: winner wins the pot payout, others lose their stake
  const bets = await GameBet.find({ gameType: 'ludo-match', roundId: matchId, status: 'pending' });
  for (const bet of bets) {
    const won = bet.selection === winner.color;
    bet.status = 'settled';
    bet.outcome = winner.color;
    if (won) {
      bet.won = true;
      bet.multiplier = winnerPayout / bet.stake;
      bet.payout = winnerPayout;
      await User.findByIdAndUpdate(bet.userId, { $inc: { balance: winnerPayout } });
    } else {
      bet.won = false;
      bet.multiplier = 0;
      bet.payout = 0;
    }
    await bet.save();
  }

  broadcast(matchId, 'ludomatch:finished', { winner: winner.color, winnerName: winner.name, payout: winnerPayout });
  broadcast(matchId, 'ludomatch:state', publicState(room));

  // Clean up after a bit so clients see the final state
  setTimeout(() => {
    for (const p of room.players) {
      if (p.userId) userMatches.delete(String(p.userId));
    }
    rooms.delete(matchId);
  }, 15_000);
};

// ===== Public API =====
const joinQueue = async (userId, name, stake, socketId) => {
  if (userMatches.has(String(userId))) {
    return { ok: false, error: 'You are already in a match' };
  }
  if (queue.some(q => String(q.userId) === String(userId))) {
    return { ok: false, error: 'Already in queue' };
  }

  // Deduct stake from user
  const user = await User.findById(userId);
  if (!user) return { ok: false, error: 'User not found' };
  if (user.banned) return { ok: false, error: 'Account suspended' };
  if (user.balance < stake) return { ok: false, error: 'Insufficient balance' };
  if (stake < 10) return { ok: false, error: 'Minimum stake is ₹10' };
  if (stake > 10000) return { ok: false, error: 'Maximum stake is ₹10000' };
  user.balance -= stake;
  await user.save();

  queue.push({ userId, name, stake, socketId, queuedAt: Date.now() });

  // If queue now has 4 same-stake players, start immediately
  const sameStakeCount = queue.filter(q => q.stake === stake).length;
  if (sameStakeCount >= MATCH_SIZE) {
    if (queueTimer) { clearTimeout(queueTimer); queueTimer = null; }
    await fillAndStartRoom();
  } else {
    ensureQueueTimer();
  }

  return { ok: true, newBalance: user.balance, queuedWith: sameStakeCount };
};

const leaveQueue = async (userId) => {
  const idx = queue.findIndex(q => String(q.userId) === String(userId));
  if (idx < 0) return { ok: false, error: 'Not in queue' };
  const entry = queue.splice(idx, 1)[0];
  // Refund stake
  await User.findByIdAndUpdate(userId, { $inc: { balance: entry.stake } });
  return { ok: true, refunded: entry.stake };
};

const getMatchForUser = (userId) => {
  const matchId = userMatches.get(String(userId));
  if (!matchId) return null;
  const room = rooms.get(matchId);
  return room ? publicState(room) : null;
};

const getMatch = (matchId) => {
  const room = rooms.get(matchId);
  return room ? publicState(room) : null;
};

const joinSocketRoom = (socket, matchId) => {
  socket.join(`ludo-match:${matchId}`);
};

const getQueueState = (userId) => {
  const inQueue = queue.find(q => String(q.userId) === String(userId));
  if (!inQueue) return null;
  const sameStake = queue.filter(q => q.stake === inQueue.stake).length;
  const startsAt = inQueue.queuedAt + QUEUE_WAIT_MS;
  return {
    stake: inQueue.stake,
    waiting: sameStake,
    needed: MATCH_SIZE,
    startsAt: new Date(Math.min(startsAt, Date.now() + QUEUE_WAIT_MS)).toISOString(),
  };
};

const init = (io) => {
  ioRef = io;
  // Handle reconnecting — on socket disconnect, leave room (game continues with bots fine)
  io.on('connection', (socket) => {
    socket.on('ludomatch:subscribe', ({ matchId }) => {
      if (matchId && rooms.has(matchId)) socket.join(`ludo-match:${matchId}`);
    });
  });
  console.log('🎲 Ludo match service initialized');
};

module.exports = {
  init,
  joinQueue,
  leaveQueue,
  doRoll,
  getMatchForUser,
  getMatch,
  getQueueState,
  joinSocketRoom,
};
