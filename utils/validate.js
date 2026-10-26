const AppError = require('./AppError');
const { isValidDateStr, isValidTimeStr } = require('./time');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

// Collects every problem in a request body, then throws one 400 error.
class Validator {
  constructor(body) {
    this.body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    this.errors = {};
    this.data = {};
  }

  fail(field, message) {
    if (!this.errors[field]) this.errors[field] = message;
  }

  has(field) {
    return this.body[field] !== undefined;
  }

  string(field, { label = field, required = true, min = 1, max = 255 } = {}) {
    const raw = this.body[field];
    if (raw === undefined || raw === null || raw === '') {
      if (required) this.fail(field, `${label} is required`);
      else this.data[field] = null;
      return this;
    }
    if (typeof raw !== 'string') { this.fail(field, `${label} must be text`); return this; }
    const v = raw.trim();
    if (v.length < min) this.fail(field, `${label} is required`);
    else if (v.length > max) this.fail(field, `${label} must be at most ${max} characters`);
    else this.data[field] = v;
    return this;
  }

  email(field = 'email', { required = true } = {}) {
    const raw = this.body[field];
    if (raw === undefined || raw === null || raw === '') {
      if (required) this.fail(field, 'Email is required');
      else this.data[field] = null;
      return this;
    }
    const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(v) || v.length > 255) this.fail(field, 'Enter a valid email address');
    else this.data[field] = v;
    return this;
  }

  phone(field = 'phone', { required = true } = {}) {
    const raw = this.body[field];
    if (raw === undefined || raw === null || raw === '') {
      if (required) this.fail(field, 'Mobile number is required');
      else this.data[field] = null;
      return this;
    }
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!PHONE_RE.test(v)) this.fail(field, 'Enter a valid phone number');
    else this.data[field] = v;
    return this;
  }

  password(field = 'password') {
    const v = this.body[field];
    if (typeof v !== 'string' || v.length < 8 || v.length > 72 || !/[A-Za-z]/.test(v) || !/\d/.test(v)) {
      this.fail(field, 'Password must be 8-72 characters and contain at least one letter and one number');
    } else {
      this.data[field] = v;
    }
    return this;
  }

  integer(field, { label = field, required = true, min = 1, max = 2147483647 } = {}) {
    const raw = this.body[field];
    if (raw === undefined || raw === null || raw === '') {
      if (required) this.fail(field, `${label} is required`);
      return this;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) this.fail(field, `${label} must be a whole number between ${min} and ${max}`);
    else this.data[field] = n;
    return this;
  }

  boolean(field, { required = false } = {}) {
    const raw = this.body[field];
    if (raw === undefined) {
      if (required) this.fail(field, `${field} is required`);
      return this;
    }
    if (typeof raw !== 'boolean') this.fail(field, `${field} must be true or false`);
    else this.data[field] = raw;
    return this;
  }

  date(field, { label = field, required = true } = {}) {
    const raw = this.body[field];
    if (raw === undefined || raw === null || raw === '') {
      if (required) this.fail(field, `${label} is required`);
      else this.data[field] = null;
      return this;
    }
    if (!isValidDateStr(raw)) this.fail(field, `${label} must be a valid date (YYYY-MM-DD)`);
    else this.data[field] = raw;
    return this;
  }

  time(field, { label = field, required = true } = {}) {
    const raw = this.body[field];
    if (raw === undefined || raw === null || raw === '') {
      if (required) this.fail(field, `${label} is required`);
      else this.data[field] = null;
      return this;
    }
    if (!isValidTimeStr(raw)) this.fail(field, `${label} must be a valid time (HH:MM)`);
    else this.data[field] = raw;
    return this;
  }

  oneOf(field, allowed, { required = true } = {}) {
    const raw = this.body[field];
    if (raw === undefined || raw === null || raw === '') {
      if (required) this.fail(field, `${field} is required`);
      return this;
    }
    if (!allowed.includes(raw)) this.fail(field, `${field} must be one of: ${allowed.join(', ')}`);
    else this.data[field] = raw;
    return this;
  }

  done() {
    if (Object.keys(this.errors).length > 0) {
      throw new AppError(400, 'Please fix the highlighted fields', 'VALIDATION_ERROR', this.errors);
    }
    return this.data;
  }
}

// Route params like /:id must be positive whole numbers.
function parseId(raw, label = 'ID') {
  if (!/^\d{1,10}$/.test(String(raw))) throw new AppError(400, `Invalid ${label}`, 'INVALID_ID');
  const n = Number(raw);
  if (n < 1 || n > 2147483647) throw new AppError(400, `Invalid ${label}`, 'INVALID_ID');
  return n;
}

module.exports = { Validator, parseId, EMAIL_RE };
