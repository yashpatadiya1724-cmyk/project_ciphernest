const Secret = require('../models/Secret');
const CryptoJS = require('crypto-js');
const { ActivityLog } = require('../models/index');

const ENCRYPTION_KEY = process.env.JWT_SECRET || 'vault_backup_key_2024';

// @desc Add new secret
const addSecret = async (req, res) => {
  try {
    const { label, value, category, icon } = req.body;
    if (!label || !value) return res.status(400).json({ message: 'Label and value are required' });

    const userId = req.user._id;

    // Encrypt the value
    const encryptedValue = CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();

    const secret = await Secret.create({
      userId,
      label,
      encryptedValue,
      category: category || 'General',
      icon: icon || '🔒'
    });

    await ActivityLog.create({
      userId,
      action: 'Secret added',
      details: `Added new secret: ${label}`,
      icon: '🔑'
    });

    res.status(201).json({
      _id: secret._id,
      label: secret.label,
      category: secret.category,
      icon: secret.icon,
      createdAt: secret.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add secret', error: error.message });
  }
};

// @desc Get all secrets for user
const getSecrets = async (req, res) => {
  try {
    const secrets = await Secret.find({ userId: req.user._id }).sort({ createdAt: -1 });
    
    // We don't decrypt values here for security, they must be requested individually
    const sanitizedSecrets = secrets.map(s => ({
      _id: s._id,
      label: s.label,
      category: s.category,
      icon: s.icon,
      createdAt: s.createdAt
    }));

    res.json(sanitizedSecrets);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch secrets' });
  }
};

// @desc Reveal a secret value
const revealSecret = async (req, res) => {
  try {
    const secret = await Secret.findOne({ _id: req.params.id, userId: req.user._id });
    if (!secret) return res.status(404).json({ message: 'Secret not found' });

    // Decrypt the value
    const bytes = CryptoJS.AES.decrypt(secret.encryptedValue, ENCRYPTION_KEY);
    const originalValue = bytes.toString(CryptoJS.enc.Utf8);

    if (!originalValue) throw new Error('Decryption failed');

    await ActivityLog.create({
      userId: req.user._id,
      action: 'Secret viewed',
      details: `Accessed secret: ${secret.label}`,
      icon: '👁️'
    });

    res.json({ value: originalValue });
  } catch (error) {
    res.status(500).json({ message: 'Decryption failed', error: error.message });
  }
};

// @desc Delete a secret
const deleteSecret = async (req, res) => {
  try {
    const secret = await Secret.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!secret) return res.status(404).json({ message: 'Secret not found' });

    await ActivityLog.create({
      userId: req.user._id,
      action: 'Secret deleted',
      details: `Removed secret: ${secret.label}`,
      icon: '🗑️'
    });

    res.json({ message: 'Secret deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete secret' });
  }
};

module.exports = { addSecret, getSecrets, revealSecret, deleteSecret };
