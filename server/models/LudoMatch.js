const mongoose = require('mongoose');

// A single 4-player Ludo match room. Pawn positions and turn order
// are tracked in-memory by the service; DB persistence is used for
// history and for letting users reconnect after disconnect.
const playerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  color: { type: String, enum: ['red', 'blue', 'green', 'yellow'] },
  position: { type: Number, default: 0 },          // 0 = base, 1..TRACK = board
  isBot: { type: Boolean, default: false },
  stake: { type: Number, default: 0 },
  finishedAt: Date,                                  // when pawn reached the end
}, { _id: false });

const ludoMatchSchema = new mongoose.Schema({
  matchId: { type: String, required: true, unique: true, index: true },
  players: [playerSchema],
  phase: { type: String, enum: ['queued', 'playing', 'finished', 'cancelled'], default: 'queued' },
  currentTurn: { type: Number, default: 0 },         // index into players
  lastRoll: { type: Number, default: 0 },
  stake: { type: Number, default: 0 },
  pot: { type: Number, default: 0 },
  winner: { type: String },                          // winning color
  winnerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  startedAt: Date,
  finishedAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('LudoMatch', ludoMatchSchema);
