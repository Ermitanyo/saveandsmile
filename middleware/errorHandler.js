const AppError = require('../utils/AppError');

const notFound = (req, res, next) => {
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND'));
};

// Last stop for every error. Never sends stack traces or database details to the browser.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, message: err.message, code: err.code, errors: err.errors });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request body', code: 'INVALID_JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE' });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ success: false, message: 'Validation failed', code: 'VALIDATION_ERROR', errors: err.errors.map((e) => e.message) });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ success: false, message: 'That value is already in use', code: 'DUPLICATE' });
  }
  if (err.name === 'SequelizeExclusionConstraintError' || (err.parent && err.parent.code === '23P01')) {
    return res.status(409).json({ success: false, message: 'That time slot was just taken. Please choose another time.', code: 'SLOT_UNAVAILABLE' });
  }

  // Unexpected: log the message and stack on the server only (no request bodies, no passwords).
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);
  return res.status(500).json({ success: false, message: 'Something went wrong on the server', code: 'SERVER_ERROR' });
};

module.exports = { notFound, errorHandler };
