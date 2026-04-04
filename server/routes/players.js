const express = require('express');
const Player = require('../models/Player');
const router = express.Router();

// Get players for a match (by team names)
router.get('/match/:matchId', async (req, res) => {
  try {
    const Match = require('../models/Match');
    const match = await Match.findById(req.params.matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });

    const players = await Player.find({
      team: { $in: [match.teamA, match.teamB] }
    }).sort({ team: 1, role: 1, name: 1 });

    res.json({
      teamA: { name: match.teamA, players: players.filter(p => p.team === match.teamA) },
      teamB: { name: match.teamB, players: players.filter(p => p.team === match.teamB) },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
