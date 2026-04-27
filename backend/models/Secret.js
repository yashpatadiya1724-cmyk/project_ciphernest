const mongoose = require('mongoose');

const secretSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  label: { type: String, required: true },
  encryptedValue: { type: String, required: true },
  category: { type: String, default: 'General' },
  icon: { type: String, default: '🔒' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Secret', secretSchema);
