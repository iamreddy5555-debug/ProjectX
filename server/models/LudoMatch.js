const mongoose = require('mongoose');

// Per-pawn state. progress encoding:
//   0     = in base
//   1..51 = on outer track (1 = this color's entry square)
//   52..56 = home column (5 cells)
//   57    = finished (goal)
const pawnSchema = new mongoose.Schema({
  id: Number,          // 0..3
  progress: { type: Number, default: 0 },
}, { _id: false });

const playerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  color: { type: String, enum: ['red', 'blue', 'green', 'yellow'] },
  pawns: { type: [pawnSchema], default: () => [0,1,2,3].map(id => ({ id, progress: 0 })) },
  isBot: { type: Boolean, default: false },
  stake: { type: Number, default: 0 },
  finishedAt: Date,    // when all 4 pawns have progress=57
  rank: Number,        // 1=winner, 2,3,4 for standings
}, { _id: false });

const ludoMatchSchema = new mongoose.Schema({
  matchId: { type: String, required: true, unique: true, index: true },
  players: [playerSchema],
  phase: { type: String, enum: ['queued', 'playing', 'finished', 'cancelled'], default: 'queued' },
  currentTurn: { type: Number, default: 0 },
  lastRoll: { type: Number, default: 0 },
  stake: { type: Number, default: 0 },
  pot: { type: Number, default: 0 },
  winner: { type: String },
  winnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startedAt: Date,
  finishedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('LudoMatch', ludoMatchSchema);
