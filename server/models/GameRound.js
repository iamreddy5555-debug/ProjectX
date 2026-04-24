const mongoose = require('mongoose');

// A shared round that all connected users see at the same time.
// One document per round per game type.
const gameRoundSchema = new mongoose.Schema({
  gameType: { type: String, enum: ['color', 'coinflip', 'aviator', 'ludo'], required: true, index: true },
  roundId: { type: String, required: true, unique: true, index: true },
  phase: { type: String, enum: ['betting', 'racing', 'flying', 'revealing', 'settled'], default: 'betting' },
  startedAt: { type: Date, required: true },
  bettingEndsAt: { type: Date },       // when betting closes
  revealAt: { type: Date },            // when result is revealed (color/coinflip)
  settledAt: { type: Date },
  // Outcome fields
  result: { type: mongoose.Schema.Types.Mixed }, // { number, colors } | 'heads'/'tails' | crashPoint
  crashPoint: { type: Number },        // aviator only — set at round start
}, { timestamps: true });

gameRoundSchema.index({ gameType: 1, createdAt: -1 });

module.exports = mongoose.model('GameRound', gameRoundSchema);
