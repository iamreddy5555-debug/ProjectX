const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
  amount: { type: Number, required: true, min: 1 },
  qrCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'QRCode' },
  screenshotUrl: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote: { type: String, default: '' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date },
  utrNumber: { type: String, default: '' },
  // Withdrawal bank details
  accountNumber: { type: String, default: '' },
  ifscCode: { type: String, default: '' },
  accountHolder: { type: String, default: '' },
  bankName: { type: String, default: '' },
  withdrawUpiId: { type: String, default: '' },
  withdrawMethod: { type: String, enum: ['bank', 'upi', ''], default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
