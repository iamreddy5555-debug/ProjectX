const mongoose = require('mongoose');

const gameBetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gameType: { type: String, enum: ['color', 'coinflip', 'aviator', 'ludo', 'ludo-match'], required: true },
  selection: { type: String, required: true },   // 'red', 'green', 'violet', '0'-'9', 'heads', 'tails', or 'aviator-pending'
  stake: { type: Number, required: true, min: 1 },
  outcome: { type: String, default: '' },         // e.g. the rolled number, 'heads'/'tails', or 'crashed'/'cashout'
  multiplier: { type: Number, default: 0 },       // payout multiplier applied
  payout: { type: Number, default: 0 },           // gross amount credited back (0 if lost)
  won: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'settled'], default: 'settled' },
  // Aviator-only fields
  crashPoint: { type: Number },
  startedAt: { type: Date },
  // Shared-round reference (color / coinflip / aviator — not ludo)
  roundId: { type: String, index: true },
}, { timestamps: true });

module.exports = mongoose.model('GameBet', gameBetSchema);
