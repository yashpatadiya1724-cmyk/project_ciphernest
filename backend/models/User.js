const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Valid roles defined in PROJECT_CONSTITUTION.md §3 (RBAC)
const VALID_ROLES = ['ROLE_ADMIN', 'ROLE_SOC', 'ROLE_CISO'];

const userSchema = new mongoose.Schema({
  username:           { type: String, required: true, unique: true, trim: true },
  email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:           { type: String, required: true, minlength: 6 },
  // PROJECT_CONSTITUTION.md §3 — Role-Based Access Control
  // ROLE_ADMIN : full platform access (simulation, config, user management)
  // ROLE_SOC   : threat triage, live alerts, active remediation
  // ROLE_CISO  : reporting, risk trends, compliance metrics  
  role:               { type: String, enum: VALID_ROLES, default: 'ROLE_SOC' },
  securityScore:      { type: Number, default: 75 },
  twoFactorSecret:    { type: String },
  isTwoFactorEnabled: { type: Boolean, default: false },
  createdAt:          { type: Date, default: Date.now },
  lastLogin:          { type: Date }
});

module.exports.VALID_ROLES = VALID_ROLES;

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
