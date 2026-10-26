const { Setting } = require('../models');

// Booking rules the admin can change. Defaults apply until the admin saves a value.
const DEFAULTS = {
  slotIntervalMinutes: 30,    // how often a new appointment can start
  minNoticeHours: 2,          // patients must book at least this far ahead
  maxAdvanceDays: 60,         // patients can book at most this far ahead
  cancellationCutoffHours: 24,// patients can cancel confirmed appointments up to this many hours before
  maxActivePerPatient: 3,     // open (pending/confirmed) appointments one patient may hold
};

const LIMITS = {
  slotIntervalMinutes: [15, 120],
  minNoticeHours: [0, 168],
  maxAdvanceDays: [1, 365],
  cancellationCutoffHours: [0, 168],
  maxActivePerPatient: [1, 20],
};

async function getSettings(options = {}) {
  const rows = await Setting.findAll(options);
  const result = { ...DEFAULTS };
  rows.forEach((r) => {
    if (r.key in DEFAULTS && Number.isFinite(Number(r.value))) result[r.key] = Number(r.value);
  });
  return result;
}

module.exports = { getSettings, DEFAULTS, LIMITS };
