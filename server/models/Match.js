const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  title: { type: String, required: true },
  teamA: { type: String, required: true },
  teamB: { type: String, required: true },
  league: { type: String, default: 'Cricket' },
  startTime: { type: Date, required: true },
  status: { type: String, enum: ['upcoming', 'live', 'completed'], default: 'upcoming' },
  oddsTeamA: { back: { type: Number, default: 1.5 }, lay: { type: Number, default: 1.55 } },
  oddsTeamB: { back: { type: Number, default: 2.5 }, lay: { type: Number, default: 2.55 } },
  oddsDraw: { back: { type: Number, default: 3.0 }, lay: { type: Number, default: 3.1 } },
  // Custom payout multiplier — what users get back if they win (e.g. 2.0 = double the stake)
  winMultiplier: { type: Number, default: 2.0, min: 1.01 },
  scoreA: { type: String, default: '' },
  scoreB: { type: String, default: '' },
  result: { type: String, default: '' },
  apiId: { type: String },
  isCustom: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);
