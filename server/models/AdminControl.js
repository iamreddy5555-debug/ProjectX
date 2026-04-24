const mongoose = require('mongoose');

// Singleton document holding admin overrides for game outcomes.
// Each override is one-shot by default: used on the next matching bet, then cleared.
const adminControlSchema = new mongoose.Schema({
  _id: { type: String, default: 'singleton' },

  // Force the next color game roll (0-9). null = random.
  nextColorRoll: { type: Number, min: 0, max: 9, default: null },
  nextColorMode: { type: String, enum: ['oneshot', 'persistent'], default: 'oneshot' },
  nextColorSetBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nextColorSetAt: { type: Date },

  // Force the next Aviator crash point. null = random.
  nextAviatorCrash: { type: Number, min: 1.0, max: 100, default: null },
  nextAviatorMode: { type: String, enum: ['oneshot', 'persistent'], default: 'oneshot' },
  nextAviatorSetBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nextAviatorSetAt: { type: Date },

  // Force the next Ludo winner color. null = random.
  nextLudoWinner: { type: String, enum: ['red', 'blue', 'green', 'yellow', null], default: null },
  nextLudoMode: { type: String, enum: ['oneshot', 'persistent'], default: 'oneshot' },
  nextLudoSetBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  nextLudoSetAt: { type: Date },
}, { timestamps: true, _id: false });

adminControlSchema.statics.getSingleton = async function () {
  let doc = await this.findById('singleton');
  if (!doc) doc = await this.create({ _id: 'singleton' });
  return doc;
};

module.exports = mongoose.model('AdminControl', adminControlSchema);
