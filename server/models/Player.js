const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  team: { type: String, required: true }, // e.g. "Mumbai Indians"
  role: { type: String, enum: ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'], required: true },
  credit: { type: Number, default: 8.5 }, // fantasy credit points (budget)
  imageUrl: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Player', playerSchema);
