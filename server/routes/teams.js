const express = require('express');
const FantasyTeam = require('../models/FantasyTeam');
const Match = require('../models/Match');
const Player = require('../models/Player');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Create a fantasy team for a match
router.post('/', auth, async (req, res) => {
  try {
    const { matchId, name, players, captain, viceCaptain } = req.body;

    if (!matchId || !players || players.length !== 11 || !captain || !viceCaptain) {
      return res.status(400).json({ message: 'Select exactly 11 players with a Captain and Vice Captain' });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    if (match.status === 'completed') return res.status(400).json({ message: 'Match already completed' });
    if (match.status === 'live') return res.status(400).json({ message: 'Match has already started — team creation is closed' });
    if (new Date(match.startTime) <= new Date()) return res.status(400).json({ message: 'Match has already started — team creation is closed' });

    // Validate player composition
    const playerDocs = await Player.find({ _id: { $in: players } });
    if (playerDocs.length !== 11) return res.status(400).json({ message: 'Invalid players selected' });

    // Check team composition: max 7 from one team
    const teamCounts = {};
    playerDocs.forEach(p => { teamCounts[p.team] = (teamCounts[p.team] || 0) + 1; });
    for (const count of Object.values(teamCounts)) {
      if (count > 7) return res.status(400).json({ message: 'Maximum 7 players from one team allowed' });
    }

    // Check role composition: min 1 WK, min 2 BAT, min 2 BOWL
    const roleCounts = { 'wicket-keeper': 0, 'batsman': 0, 'bowler': 0, 'all-rounder': 0 };
    playerDocs.forEach(p => { roleCounts[p.role] = (roleCounts[p.role] || 0) + 1; });
    if (roleCounts['wicket-keeper'] < 1) return res.status(400).json({ message: 'Select at least 1 Wicket Keeper' });
    if (roleCounts['batsman'] < 2) return res.status(400).json({ message: 'Select at least 2 Batsmen' });
    if (roleCounts['bowler'] < 2) return res.status(400).json({ message: 'Select at least 2 Bowlers' });

    // Calculate total credits
    const totalCredits = playerDocs.reduce((sum, p) => sum + p.credit, 0);
    if (totalCredits > 100) return res.status(400).json({ message: 'Total credits exceed 100. Remove some expensive players.' });

    const team = new FantasyTeam({
      userId: req.user.id,
      matchId,
      name: name || 'My Team',
      players,
      captain,
      viceCaptain,
      totalCredits,
    });
    await team.save();
    await team.populate('players');

    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's teams for a match
router.get('/match/:matchId', auth, async (req, res) => {
  try {
    const teams = await FantasyTeam.find({ userId: req.user.id, matchId: req.params.matchId })
      .populate('players')
      .populate('captain', 'name role')
      .populate('viceCaptain', 'name role');
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all user's teams
router.get('/my', auth, async (req, res) => {
  try {
    const teams = await FantasyTeam.find({ userId: req.user.id })
      .populate('matchId', 'title teamA teamB startTime status')
      .populate('players', 'name role team')
      .populate('captain', 'name')
      .populate('viceCaptain', 'name')
      .sort({ createdAt: -1 });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
