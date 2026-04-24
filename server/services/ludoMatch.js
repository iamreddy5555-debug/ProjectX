// Proper 4-player Ludo (Ludo King-style) match service.
//
// Rules implemented:
//   - 4 players, 4 pawns each (16 pawns total)
//   - Each color enters the track at its OWN entry square (not the same one)
//   - 51 outer track squares of travel for each color → then 5 home-column squares
//     → final finish square (exact roll required)
//   - Must roll 6 to take a pawn out of base
//   - Rolling 6 grants an extra turn; three 6s in a row forfeits the turn
//   - Landing on an opponent pawn (on a non-safe square) captures it → back to base
//   - Stacking own pawns is allowed (no block rule here to keep it clean)
//   - Safe squares: 8 of them (each color's entry + 4 additional marked with a star)
//   - Win: first player to get all 4 pawns to the finish

const LudoMatch = require('../models/LudoMatch');
const GameBet = require('../models/GameBet');
const User = require('../models/User');
const AdminControl = require('../models/AdminControl');
const crypto = require('crypto');

const MATCH_SIZE = 4;
const QUEUE_WAIT_MS = 60_000;
const TURN_TIMEOUT_MS = 25_000;
// Natural-feeling bot pacing: usually 1.5–3s, sometimes up to 5s ("deliberating")
const botDelay = () => {
  if (Math.random() < 0.2) {
    return 3000 + Math.floor(Math.random() * 2000); // 3000–5000ms (~20% of turns)
  }
  return 1500 + Math.floor(Math.random() * 1500);   // 1500–3000ms (~80%)
};
const COLORS = ['red', 'blue', 'green', 'yellow'];
const HOUSE_CUT = 0.125;

// Color entry indexes on a 52-square outer track
const COLOR_START = { green: 0, yellow: 13, blue: 26, red: 39 };

// Safe squares (indexes on outer track, 0-51)
const SAFE_SET = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Pawn progress constants
const BASE = 0;
const OUTER_LAST = 51;       // progress 1..51 = outer track
const HOME_START = 52;       // progress 52..56 = home column
const FINISH = 57;

let ioRef = null;

// ---- In-memory state ----
const queue = [];                  // pending players { userId, name, stake, queuedAt, socketId }
const rooms = new Map();
const userMatches = new Map();
let queueTimer = null;

const newId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const broadcast = (matchId, event, payload) => {
  if (!ioRef) return;
  ioRef.to(`ludo-match:${matchId}`).emit(event, payload);
};

// Which outer-track index does a pawn of this color sit on, given its progress?
const outerIndexFor = (color, progress) => {
  if (progress < 1 || progress > OUTER_LAST) return null;
  return (COLOR_START[color] + progress - 1) % 52;
};

// Compute which pawns of the current player CAN move given the rolled value
const movablePawns = (player, roll) => {
  const out = [];
  for (const pawn of player.pawns) {
    if (pawn.progress === BASE) {
      // Only 6 can release a pawn
      if (roll === 6) out.push(pawn.id);
    } else if (pawn.progress >= FINISH) {
      // already finished
      continue;
    } else {
      const next = pawn.progress + roll;
      // Cannot overshoot finish (need exact roll to land on 57)
      if (next <= FINISH) out.push(pawn.id);
    }
  }
  return out;
};

// Apply a move + handle captures + check finish; returns { captured: [{color}], finished: bool, landedAt }
const movePawn = (room, player, pawnId, roll) => {
  const pawn = player.pawns.find(p => p.id === pawnId);
  let captured = [];

  if (pawn.progress === BASE) {
    if (roll !== 6) return { error: 'Must roll 6 to release pawn' };
    pawn.progress = 1;
  } else {
    const next = pawn.progress + roll;
    if (next > FINISH) return { error: 'Overshoot' };
    pawn.progress = next;
  }

  // Captures: only for pawns currently on the outer track and on a non-safe square
  if (pawn.progress >= 1 && pawn.progress <= OUTER_LAST) {
    const outerIdx = outerIndexFor(player.color, pawn.progress);
    if (!SAFE_SET.has(outerIdx)) {
      for (const other of room.players) {
        if (other.color === player.color) continue;
        for (const op of other.pawns) {
          if (op.progress >= 1 && op.progress <= OUTER_LAST) {
            const otherOuterIdx = outerIndexFor(other.color, op.progress);
            if (otherOuterIdx === outerIdx) {
              op.progress = BASE;
              captured.push({ color: other.color, pawnId: op.id });
            }
          }
        }
      }
    }
  }

  const finished = pawn.progress === FINISH;
  return { captured, finished, landedAt: pawn.progress };
};

// ---- Publishable state ----
const publicState = (room) => ({
  matchId: room.matchId,
  phase: room.phase,
  currentTurn: room.currentTurn,
  lastRoll: room.lastRoll,
  stake: room.stake,
  pot: room.pot,
  winner: room.winner,
  turnEndsAt: room.turnEndsAt,
  awaitingMove: room.awaitingMove || null,
  sixStreak: room.sixStreak,
  players: room.players.map(p => ({
    userId: String(p.userId || ''),
    name: p.name,
    color: p.color,
    // Intentionally not exposing isBot to clients — filled seats look real.
    rank: p.rank || null,
    pawns: p.pawns.map(pn => ({
      id: pn.id,
      progress: pn.progress,
      outerIndex: outerIndexFor(p.color, pn.progress),
    })),
  })),
});

// ==== Matchmaking ====
const ensureQueueTimer = () => {
  if (queueTimer || queue.length === 0) return;
  queueTimer = setTimeout(() => {
    queueTimer = null;
    fillAndStartRoom();
  }, QUEUE_WAIT_MS);
};

const fillAndStartRoom = async () => {
  if (queue.length === 0) return;
  const firstStake = queue[0].stake;
  const sameStake = queue.filter(q => q.stake === firstStake).slice(0, MATCH_SIZE);
  if (sameStake.length === 0) return;
  for (const p of sameStake) {
    const idx = queue.findIndex(q => q.userId === p.userId);
    if (idx >= 0) queue.splice(idx, 1);
  }

  const botsNeeded = MATCH_SIZE - sameStake.length;
  // Realistic name pool so filled seats are indistinguishable from real players
  const namePool = [
    'Raj', 'Priya', 'Karan', 'Neha', 'Arjun', 'Ananya', 'Rohit', 'Pooja',
    'Amit', 'Kiara', 'Vikram', 'Sneha', 'Rahul', 'Meera', 'Aditya', 'Isha',
    'Sameer', 'Kavya', 'Dev', 'Riya', 'Akash', 'Nisha', 'Varun', 'Tanya',
    'Harsh', 'Deepika', 'Shivam', 'Aanya', 'Yash', 'Simran',
  ];
  // Avoid duplicating names already at the table
  const taken = new Set(sameStake.map(p => p.name));
  const shuffledPool = [...namePool].sort(() => Math.random() - 0.5)
    .filter(n => !taken.has(n));
  for (let i = 0; i < botsNeeded; i++) {
    sameStake.push({
      userId: null,
      name: shuffledPool[i] || `Player${Math.floor(Math.random() * 900) + 100}`,
      stake: firstStake,
      isBot: true,
    });
  }

  const shuffled = [...COLORS].sort(() => Math.random() - 0.5);
  const players = sameStake.map((p, i) => ({
    userId: p.userId || null,
    name: p.name,
    color: shuffled[i],
    pawns: [0,1,2,3].map(id => ({ id, progress: 0 })),
    isBot: !!p.isBot,
    stake: firstStake,
    rank: null,
  }));

  const matchId = newId('ludo-match');
  const pot = firstStake * MATCH_SIZE;

  await LudoMatch.create({
    matchId, players, phase: 'playing', currentTurn: 0,
    stake: firstStake, pot, startedAt: new Date(),
  });

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

  const room = {
    matchId, players,
    phase: 'playing',
    currentTurn: 0,
    lastRoll: 0,
    stake: firstStake,
    pot,
    winner: null,
    turnEndsAt: null,
    sixStreak: 0,
    awaitingMove: null,          // { roll, options: [pawnId,...] }
    turnTimeout: null,
    rankCounter: 0,              // increments when a player finishes all 4 pawns
    nextDice: null,              // per-match admin dice override (1-6)
    nextDiceMode: 'oneshot',
    createdAt: new Date(),
  };
  rooms.set(matchId, room);
  for (const p of players) {
    if (p.userId) userMatches.set(String(p.userId), matchId);
  }

  if (ioRef) {
    for (const p of sameStake) {
      if (p.socketId) {
        const s = ioRef.sockets.sockets.get(p.socketId);
        if (s) s.join(`ludo-match:${matchId}`);
      }
    }
  }
  broadcast(matchId, 'ludomatch:state', publicState(room));

  scheduleTurn(matchId);

  if (queue.length >= 1) ensureQueueTimer();
};

// ==== Turn engine ====
const scheduleTurn = (matchId) => {
  const room = rooms.get(matchId);
  if (!room || room.phase !== 'playing') return;
  const current = room.players[room.currentTurn];

  room.turnEndsAt = new Date(Date.now() + TURN_TIMEOUT_MS).toISOString();
  room.awaitingMove = null;
  broadcast(matchId, 'ludomatch:state', publicState(room));

  if (current.isBot) {
    if (room.turnTimeout) clearTimeout(room.turnTimeout);
    room.turnTimeout = setTimeout(() => botRoll(matchId), botDelay());
    return;
  }

  if (room.turnTimeout) clearTimeout(room.turnTimeout);
  room.turnTimeout = setTimeout(() => advanceTurn(matchId), TURN_TIMEOUT_MS);
};

const advanceTurn = (matchId) => {
  const room = rooms.get(matchId);
  if (!room) return;
  room.sixStreak = 0;
  room.awaitingMove = null;

  let next = (room.currentTurn + 1) % room.players.length;
  let safety = 0;
  while (room.players[next].rank && safety++ < 4) {
    next = (next + 1) % room.players.length;
  }
  room.currentTurn = next;
  scheduleTurn(matchId);
};

const rollDice = async (control, room) => {
  // Per-match override (admin targeted this specific room)
  if (room && typeof room.nextDice === 'number') {
    const v = room.nextDice;
    if (room.nextDiceMode !== 'persistent') {
      room.nextDice = null;
    }
    return v;
  }
  // Global override (applies to any match's next roll)
  if (typeof control.nextLudoMatchDice === 'number') {
    const v = control.nextLudoMatchDice;
    if (control.nextLudoMatchMode === 'oneshot') {
      control.nextLudoMatchDice = null;
      await control.save();
    }
    return v;
  }
  return Math.floor(Math.random() * 6) + 1;
};

// Roll for the current player. If multiple movable pawns exist, wait for pick.
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
  if (room.awaitingMove) return { ok: false, error: 'Pick a pawn first' };

  if (room.turnTimeout) { clearTimeout(room.turnTimeout); room.turnTimeout = null; }

  const control = await AdminControl.getSingleton();
  const roll = await rollDice(control, room);
  room.lastRoll = roll;

  broadcast(matchId, 'ludomatch:roll', { color: current.color, roll });

  // Three sixes in a row forfeits
  if (roll === 6) {
    room.sixStreak = (room.sixStreak || 0) + 1;
    if (room.sixStreak >= 3) {
      broadcast(matchId, 'ludomatch:state', { ...publicState(room), lastRoll: roll });
      advanceTurn(matchId);
      return { ok: true, roll, turnForfeited: true };
    }
  } else {
    room.sixStreak = 0;
  }

  const options = movablePawns(current, roll);

  if (options.length === 0) {
    // No moves; if rolled 6, extra turn; else pass
    broadcast(matchId, 'ludomatch:state', { ...publicState(room), lastRoll: roll });
    if (roll === 6) {
      scheduleTurn(matchId);
    } else {
      advanceTurn(matchId);
    }
    return { ok: true, roll, moved: false };
  }

  if (options.length === 1) {
    if (current.isBot) {
      // Give the dice time to visually settle before the bot moves.
      setTimeout(() => applyMove(matchId, options[0], roll), botDelay());
    } else {
      await applyMove(matchId, options[0], roll);
    }
  } else {
    // Waiting for pawn pick
    room.awaitingMove = { roll, options };
    broadcast(matchId, 'ludomatch:state', publicState(room));
    if (current.isBot) {
      // Bot picks best move: prefer capture > finish > advance-further > leave-base
      const chosen = botChoose(room, current, options, roll);
      setTimeout(() => applyMove(matchId, chosen, roll), botDelay());
    } else {
      // Timeout — if human doesn't pick, auto-pick first option after TURN_TIMEOUT_MS
      if (room.turnTimeout) clearTimeout(room.turnTimeout);
      room.turnTimeout = setTimeout(() => applyMove(matchId, options[0], roll), TURN_TIMEOUT_MS);
    }
  }

  return { ok: true, roll };
};

const botChoose = (room, player, options, roll) => {
  // Heuristic bot: captures > finish > farthest pawn
  let bestScore = -Infinity;
  let best = options[0];
  for (const pawnId of options) {
    const pawn = player.pawns.find(pn => pn.id === pawnId);
    const wouldBeAt = pawn.progress === BASE ? 1 : pawn.progress + roll;
    let score = wouldBeAt;
    if (wouldBeAt === FINISH) score += 1000;
    // Check capture
    if (wouldBeAt >= 1 && wouldBeAt <= OUTER_LAST) {
      const outerIdx = (COLOR_START[player.color] + wouldBeAt - 1) % 52;
      if (!SAFE_SET.has(outerIdx)) {
        for (const other of room.players) {
          if (other.color === player.color) continue;
          for (const op of other.pawns) {
            if (op.progress >= 1 && op.progress <= OUTER_LAST) {
              const oi = (COLOR_START[other.color] + op.progress - 1) % 52;
              if (oi === outerIdx) score += 500;
            }
          }
        }
      }
    }
    if (score > bestScore) { bestScore = score; best = pawnId; }
  }
  return best;
};

// Client invokes this to pick a specific pawn when there are multiple movable pawns
const pickPawn = async (matchId, userId, pawnId) => {
  const room = rooms.get(matchId);
  if (!room || room.phase !== 'playing') return { ok: false, error: 'Match not active' };
  const current = room.players[room.currentTurn];
  if (!current.userId || String(current.userId) !== String(userId)) {
    return { ok: false, error: 'Not your turn' };
  }
  if (!room.awaitingMove) return { ok: false, error: 'Nothing to pick' };
  if (!room.awaitingMove.options.includes(pawnId)) return { ok: false, error: 'Invalid pawn choice' };
  if (room.turnTimeout) { clearTimeout(room.turnTimeout); room.turnTimeout = null; }
  await applyMove(matchId, pawnId, room.awaitingMove.roll);
  return { ok: true };
};

const applyMove = async (matchId, pawnId, roll) => {
  const room = rooms.get(matchId);
  if (!room || room.phase !== 'playing') return;
  const current = room.players[room.currentTurn];
  const result = movePawn(room, current, pawnId, roll);
  if (result.error) {
    // Shouldn't happen (options pre-validated)
    advanceTurn(matchId);
    return;
  }

  if (result.captured?.length) {
    for (const cap of result.captured) {
      broadcast(matchId, 'ludomatch:capture', { victim: cap.color, by: current.color, pawnId: cap.pawnId });
    }
  }

  // Check if this player finished all 4 pawns
  const allDone = current.pawns.every(p => p.progress === FINISH);
  if (allDone && !current.rank) {
    current.rank = ++room.rankCounter;
    current.finishedAt = new Date();
    broadcast(matchId, 'ludomatch:finished-player', { color: current.color, rank: current.rank });
    if (current.rank === 1) {
      room.winner = current.color;
      await settleMatch(matchId, current);
      return;
    }
  }

  // Extra turn on 6 (if not three in a row and pawn not finishing)
  const gotsix = roll === 6;
  room.awaitingMove = null;
  broadcast(matchId, 'ludomatch:state', publicState(room));

  if (gotsix && room.sixStreak < 3 && !allDone) {
    scheduleTurn(matchId);
  } else {
    advanceTurn(matchId);
  }
};

const botRoll = async (matchId) => {
  const room = rooms.get(matchId);
  if (!room || room.phase !== 'playing') return;
  if (room.awaitingMove) return;
  await doRoll(matchId, null, true);
};

const settleMatch = async (matchId, winner) => {
  const room = rooms.get(matchId);
  if (!room) return;
  room.phase = 'finished';
  room.winner = winner.color;

  const winnerPayout = Math.floor(room.pot * (1 - HOUSE_CUT));

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

  broadcast(matchId, 'ludomatch:finished', {
    winner: winner.color,
    winnerName: winner.name,
    payout: winnerPayout,
  });
  broadcast(matchId, 'ludomatch:state', publicState(room));

  setTimeout(() => {
    for (const p of room.players) {
      if (p.userId) userMatches.delete(String(p.userId));
    }
    rooms.delete(matchId);
  }, 20_000);
};

// ==== Queue API ====
const joinQueue = async (userId, name, stake, socketId) => {
  if (userMatches.has(String(userId))) return { ok: false, error: 'You are already in a match' };
  if (queue.some(q => String(q.userId) === String(userId))) return { ok: false, error: 'Already in queue' };

  const user = await User.findById(userId);
  if (!user) return { ok: false, error: 'User not found' };
  if (user.banned) return { ok: false, error: 'Account suspended' };
  if (user.balance < stake) return { ok: false, error: 'Insufficient balance' };
  if (stake < 10) return { ok: false, error: 'Minimum stake is ₹10' };
  if (stake > 10000) return { ok: false, error: 'Maximum stake is ₹10000' };
  user.balance -= stake;
  await user.save();

  queue.push({ userId, name, stake, socketId, queuedAt: Date.now() });

  const sameStake = queue.filter(q => q.stake === stake).length;
  if (sameStake >= MATCH_SIZE) {
    if (queueTimer) { clearTimeout(queueTimer); queueTimer = null; }
    await fillAndStartRoom();
  } else {
    ensureQueueTimer();
  }

  return { ok: true, newBalance: user.balance, queuedWith: sameStake };
};

const leaveQueue = async (userId) => {
  const idx = queue.findIndex(q => String(q.userId) === String(userId));
  if (idx < 0) return { ok: false, error: 'Not in queue' };
  const entry = queue.splice(idx, 1)[0];
  await User.findByIdAndUpdate(userId, { $inc: { balance: entry.stake } });
  return { ok: true, refunded: entry.stake };
};

// ==== Admin getters/setters (per-match) ====
const getActiveMatches = () => {
  const out = [];
  for (const room of rooms.values()) {
    out.push({
      ...publicState(room),
      nextDice: room.nextDice ?? null,
      nextDiceMode: room.nextDiceMode || 'oneshot',
      createdAt: room.createdAt,
      // Also reveal isBot in admin view so admin can tell which seats are AI
      playersDetailed: room.players.map(p => ({
        userId: String(p.userId || ''),
        name: p.name,
        color: p.color,
        isBot: !!p.isBot,
        rank: p.rank || null,
      })),
    });
  }
  // Newest first
  out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return out;
};

const setMatchDice = (matchId, dice, mode = 'oneshot') => {
  const room = rooms.get(matchId);
  if (!room) return { ok: false, error: 'Match not found' };
  if (dice === 'clear' || dice === null) {
    room.nextDice = null;
  } else if (typeof dice === 'number' && dice >= 1 && dice <= 6) {
    room.nextDice = Math.floor(dice);
    room.nextDiceMode = mode === 'persistent' ? 'persistent' : 'oneshot';
  } else {
    return { ok: false, error: 'Dice must be 1-6' };
  }
  return { ok: true, nextDice: room.nextDice, nextDiceMode: room.nextDiceMode };
};

const getMatchForUser = (userId) => {
  const matchId = userMatches.get(String(userId));
  if (!matchId) return null;
  const room = rooms.get(matchId);
  return room ? publicState(room) : null;
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
  io.on('connection', (socket) => {
    socket.on('ludomatch:subscribe', ({ matchId }) => {
      if (matchId && rooms.has(matchId)) socket.join(`ludo-match:${matchId}`);
    });
  });
  console.log('🎲 Ludo match service initialized (4 pawns per player)');
};

module.exports = {
  init,
  joinQueue,
  leaveQueue,
  doRoll,
  pickPawn,
  getMatchForUser,
  getQueueState,
  // Admin-only
  getActiveMatches,
  setMatchDice,
  // constants for client-side path math
  COLOR_START,
  SAFE_SET,
  OUTER_LAST,
  HOME_START,
  FINISH,
};
