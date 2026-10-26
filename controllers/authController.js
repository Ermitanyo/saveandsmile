const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { sequelize, User, PatientProfile } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/respond');
const { Validator } = require('../utils/validate');

const cookieOptions = () => ({
  httpOnly: true,                                   // JavaScript in the page cannot read the token
  sameSite: 'lax',                                  // not sent on cross-site POSTs
  secure: config.nodeEnv === 'production',          // HTTPS only in production
  path: '/',
});

function startSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  res.cookie(config.jwt.cookieName, token, { ...cookieOptions(), maxAge: config.jwt.cookieMaxAgeMs });
}

// A real bcrypt hash used to keep login timing similar when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

exports.register = asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  v.string('name', { label: 'Full name', min: 2, max: 120 }).email().phone().password().boolean('privacyConsent');
  if (req.body && req.body.privacyConsent !== true) v.fail('privacyConsent', 'You must agree to the privacy notice to create an account');
  const data = v.done();

  const exists = await User.findOne({ where: { email: data.email } });
  if (exists) throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN', { email: 'This email is already registered' });

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await sequelize.transaction(async (transaction) => {
    const u = await User.create(
      { name: data.name, email: data.email, phone: data.phone, passwordHash, role: 'patient' },
      { transaction }
    );
    await PatientProfile.create({ userId: u.id, privacyConsent: true, privacyConsentAt: new Date() }, { transaction });
    return u;
  });

  startSession(res, user);
  return created(res, { user: user.toJSON() }, 'Account created');
});

exports.login = asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  v.email();
  if (typeof (req.body || {}).password !== 'string' || req.body.password === '') v.fail('password', 'Password is required');
  const { email } = v.done();

  const user = await User.scope('withPassword').findOne({ where: { email } });
  const valid = await bcrypt.compare(req.body.password, user && user.passwordHash ? user.passwordHash : DUMMY_HASH);
  if (!user || !user.passwordHash || !valid) {
    throw new AppError(401, 'Incorrect email or password', 'INVALID_CREDENTIALS');
  }
  if (!user.isActive) throw new AppError(403, 'This account has been deactivated. Please contact the clinic.', 'ACCOUNT_DISABLED');

  startSession(res, user);
  return ok(res, { user: user.toJSON() }, 'Logged in');
});

exports.logout = (req, res) => {
  res.clearCookie(config.jwt.cookieName, cookieOptions());
  return ok(res, null, 'Logged out');
};

exports.me = asyncHandler(async (req, res) => {
  const profile = req.user.role === 'patient' ? await PatientProfile.findOne({ where: { userId: req.user.id } }) : null;
  return ok(res, { user: req.user.toJSON(), profile });
});
