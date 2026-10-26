// An error we throw on purpose; the error handler turns it into a clean JSON response.
class AppError extends Error {
  constructor(status, message, code = 'ERROR', errors = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

module.exports = AppError;
