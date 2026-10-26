const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Reads the login token from the httpOnly cookie (browser) or an "Authorization: Bearer" header (Postman).
const authenticate = asyncHandler(async (req, res, next) => {
  let token = req.cookies && req.cookies[config.jwt.cookieName];
  const header = req.headers.authorization;
  if (!token && header && header.startsWith('Bearer ')) token = header.slice(7);
  if (!token) throw new AppError(401, 'Please log in to continue', 'UNAUTHENTICATED');

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    throw new AppError(401, 'Your session has expired. Please log in again', 'UNAUTHENTICATED');
  }

  // Look the user up every time so deactivated accounts lose access immediately.
  const user = await User.findByPk(payload.sub);
  if (!user || !user.isActive) throw new AppError(401, 'This account is not available', 'UNAUTHENTICATED');

  req.user = user;
  next();
});

// Usage: router.get('/x', authenticate, requireRole('staff', 'admin'), handler)
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'You do not have permission to do this', 'FORBIDDEN'));
  }
  return next();
};

// For public routes that behave differently for logged-in staff (e.g. availability).
// A missing or bad token simply means "anonymous", never an error.
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const token = (req.cookies && req.cookies[config.jwt.cookieName])
    || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      const user = await User.findByPk(payload.sub);
      if (user && user.isActive) req.user = user;
    } catch (err) {
      // ignore: treat as anonymous
    }
  }
  next();
});

const isStaffRole = (user) => user.role === 'staff' || user.role === 'admin';

module.exports = { authenticate, optionalAuthenticate, requireRole, isStaffRole };
