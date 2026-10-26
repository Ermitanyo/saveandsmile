const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const config = require('../config');
const auth = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Slows down password guessing and bulk account creation from one IP address.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again in a few minutes.', code: 'RATE_LIMITED' },
});

router.post('/register', authLimiter, auth.register);
router.post('/login', authLimiter, auth.login);
router.post('/logout', auth.logout);
router.get('/me', authenticate, auth.me);

module.exports = router;
