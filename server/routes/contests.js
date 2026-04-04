const express = require('express');
const Contest = require('../models/Contest');
const FantasyTeam = require('../models/FantasyTeam');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Get contests for a match
router.get('/match/:matchId', async (req, res) => {
  try {
    const contests = await Contest.find({ matchId: req.params.matchId })
      .populate('teams.userId', 'name')
      .sort({ entryFee: 1 });
    res.json(contests);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Join a contest
router.post('/:contestId/join', auth, async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ message: 'Select a team to join' });

    const contest = await Contest.findById(req.params.contestId);
    if (!contest) return res.status(404).json({ message: 'Contest not found' });
    if (contest.status !== 'open') return res.status(400).json({ message: 'Contest is no longer open' });
    if (contest.teams.length >= contest.maxTeams) return res.status(400).json({ message: 'Contest is full' });

    // Check if user already joined with this team
    const alreadyJoined = contest.teams.some(t => t.teamId?.toString() === teamId);
    if (alreadyJoined) return res.status(400).json({ message: 'This team already joined this contest' });

    // Check team belongs to user
    const team = await FantasyTeam.findById(teamId);
    if (!team || team.userId.toString() !== req.user.id) {
      return res.status(400).json({ message: 'Invalid team' });
    }

    // Deduct entry fee
    const user = await User.findById(req.user.id);
    if (user.balance < contest.entryFee) {
      return res.status(400).json({ message: 'Insufficient balance. Please deposit first.' });
    }

    user.balance -= contest.entryFee;
    await user.save();

    contest.teams.push({ teamId, userId: req.user.id });
    await contest.save();

    res.json({ message: 'Joined contest successfully!', newBalance: user.balance, contest });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's joined contests
router.get('/my', auth, async (req, res) => {
  try {
    const contests = await Contest.find({ 'teams.userId': req.user.id })
      .populate('matchId', 'title teamA teamB startTime status')
      .populate('teams.userId', 'name')
      .populate('teams.teamId')
      .sort({ createdAt: -1 });
    res.json(contests);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
