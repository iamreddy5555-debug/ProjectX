const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  upiId: { type: String, required: true },
  label: { type: String, default: 'Payment QR' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('QRCode', qrCodeSchema);
