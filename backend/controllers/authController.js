const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ActivityLog } = require('../models/index');

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET is not set in .env file! Authentication will fail.');
}

// Embed role in token payload so RBACMiddleware can verify without extra DB hit
// (PROJECT_CONSTITUTION.md §3 — RBAC)
//
// Phase 5.4 — MFA Roadmap:
//   Current state: JWT-only authentication. No second factor enforced.
//   Recommended next step: after verifying password, check user.isTwoFactorEnabled.
//   If true, return { mfa_required: true, temp_token } and require TOTP verification
//   at POST /api/auth/2fa/verify before issuing the full session token.
//   otplib is already installed — see controllers/2faController.js for TOTP setup.
//
// Phase 5.4 — Session timeout:
//   JWT_EXPIRE is read from environment. Set JWT_EXPIRE=1h in production .env.
//   Default fallback is 7d (development only).
const generateToken = (id, role = 'ROLE_SOC') => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  // Use JWT_EXPIRE from env — set to '1h' in production for session timeout compliance
  const expiresIn = process.env.JWT_EXPIRE || '7d';
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn });
};

// @desc Register user
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Please provide all fields' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim();

    const userExists = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with that email or username' });
    }

    const user = await User.create({ username: normalizedUsername, email: normalizedEmail, password });

    // Log activity
    await ActivityLog.create({
      userId: user._id,
      action: 'Account created',
      details: 'Welcome to CipherNest!',
      icon: '🎉'
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      securityScore: user.securityScore,
      token: generateToken(user._id, user.role)
    });
  } catch (error) {
    console.error('❌ Registration Error:', error);
    res.status(500).json({ 
      message: 'Registration failed', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
    });
  }
};

// @desc Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    user.lastLogin = new Date();
    await user.save();

    await ActivityLog.create({
      userId: user._id,
      action: 'Logged in',
      details: 'Session started',
      icon: '🔐'
    });

    // Phase 5.4 — MFA gate (roadmap stub)
    // When isTwoFactorEnabled is true, a full session token should NOT be issued here.
    // Instead return { mfa_required: true } and require TOTP at /api/auth/2fa/verify.
    // Uncomment the block below once the MFA enforcement sprint is complete:
    //
    // if (user.isTwoFactorEnabled) {
    //   const tempToken = jwt.sign({ id: user._id, mfa_pending: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
    //   return res.json({ mfa_required: true, temp_token: tempToken });
    // }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      securityScore: user.securityScore,
      // mfa_token: null — not yet issued; see Phase 5.4 roadmap above
      token: generateToken(user._id, user.role)
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

// @desc Get current user profile
const getProfile = async (req, res) => {
  res.json({
    _id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    role: req.user.role,
    securityScore: req.user.securityScore,
    isTwoFactorEnabled: req.user.isTwoFactorEnabled,
    createdAt: req.user.createdAt,
    lastLogin: req.user.lastLogin
  });
};

module.exports = { register, login, getProfile };
