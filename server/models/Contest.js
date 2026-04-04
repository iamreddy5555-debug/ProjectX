const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  name: { type: String, required: true },
  entryFee: { type: Number, required: true, min: 0 },
  prizePool: { type: Number, required: true },
  maxTeams: { type: Number, default: 100 },
  teams: [{
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'FantasyTeam' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rank: { type: Number, default: 0 },
  }],
  status: { type: String, enum: ['open', 'live', 'completed'], default: 'open' },
  prizeBreakdown: [{
    rank: { type: Number },
    prize: { type: Number },
  }],
  isCustom: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Contest', contestSchema);
