const mongoose = require('mongoose');

const fantasyTeamSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  name: { type: String, default: 'My Team' },
  players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }], // 11 players
  captain: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  viceCaptain: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  totalCredits: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('FantasyTeam', fantasyTeamSchema);
