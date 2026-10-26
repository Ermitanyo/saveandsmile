// Pure date/time helpers. The clinic runs on Philippine time (UTC+8, no DST),
// so a fixed "+08:00" offset is enough and needs no extra library.
const OFFSET_HOURS = 8;
const OFFSET = '+08:00';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isValidDateStr(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const isValidTimeStr = (s) => typeof s === 'string' && TIME_RE.test(s);
const isValidMonthStr = (s) => typeof s === 'string' && MONTH_RE.test(s);

// "09:00:00" (from PostgreSQL TIME) -> "09:00"
const normTime = (t) => (t ? String(t).slice(0, 5) : null);

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const fromMinutes = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// "2026-11-05" + "14:30" (Manila time) -> a real moment in time
const toInstant = (dateStr, timeStr) => new Date(`${dateStr}T${timeStr}:00${OFFSET}`);

// Day of the week of a calendar date (0 = Sunday ... 6 = Saturday)
const dayOfWeek = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

const shifted = (date) => new Date(date.getTime() + OFFSET_HOURS * 3600 * 1000);

// A moment in time -> Manila calendar date "YYYY-MM-DD" and clock time "HH:MM"
const manilaDate = (date) => shifted(date).toISOString().slice(0, 10);
const manilaTime = (date) => shifted(date).toISOString().slice(11, 16);

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function datesInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${monthStr}-${String(i + 1).padStart(2, '0')}`);
}

// Start (inclusive) and end (exclusive) moments of a Manila calendar day
const dayRange = (dateStr) => [toInstant(dateStr, '00:00'), toInstant(addDays(dateStr, 1), '00:00')];

module.exports = {
  isValidDateStr, isValidTimeStr, isValidMonthStr, normTime, toMinutes, fromMinutes,
  toInstant, dayOfWeek, manilaDate, manilaTime, addDays, datesInMonth, dayRange,
};
