const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  selection: { type: String, required: true }, // 'teamA', 'teamB', 'draw'
  betType: { type: String, enum: ['back', 'lay'], required: true },
  odds: { type: Number, required: true },
  stake: { type: Number, required: true, min: 1 },
  potentialWin: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'won', 'lost', 'cancelled'], default: 'pending' },
  settledAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Bet', betSchema);
