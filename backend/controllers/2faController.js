const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const User = require('../models/User');

/**
 * @desc Generate 2FA secret and QR code
 */
const setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'CipherNest', secret);
    
    // Save temporary secret (only enable after verification)
    user.twoFactorSecret = secret;
    await user.save();

    const qrCodeUrl = await qrcode.toDataURL(otpauth);
    res.json({ secret, qrCodeUrl });
  } catch (error) {
    res.status(500).json({ message: '2FA setup failed', error: error.message });
  }
};

/**
 * @desc Verify 2FA code and enable it
 */
const verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id);
    
    const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
    
    if (isValid) {
      user.isTwoFactorEnabled = true;
      await user.save();
      res.json({ message: '2FA enabled successfully' });
    } else {
      res.status(400).json({ message: 'Invalid 2FA token' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Verification failed' });
  }
};

/**
 * @desc Disable 2FA
 */
const disable2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.isTwoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();
    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to disable 2FA' });
  }
};

module.exports = { setup2FA, verify2FA, disable2FA };
