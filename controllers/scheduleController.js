const { Op } = require('sequelize');
const { sequelize, ClinicSchedule, BlockedDate, Setting, Appointment } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/respond');
const { Validator, parseId } = require('../utils/validate');
const { isValidTimeStr, toMinutes, normTime, manilaDate, dayRange, isValidDateStr } = require('../utils/time');
const { getSettings, LIMITS } = require('../services/settingsService');
const { ACTIVE_STATUSES } = require('../services/slotEngine');

const shapeSchedule = (s) => ({
  dayOfWeek: s.dayOfWeek,
  isOpen: s.isOpen,
  openTime: normTime(s.openTime),
  closeTime: normTime(s.closeTime),
  breakStart: normTime(s.breakStart),
  breakEnd: normTime(s.breakEnd),
});

// ---- Weekly opening hours ---------------------------------------------------------

exports.getSchedules = asyncHandler(async (req, res) => {
  const rows = await ClinicSchedule.findAll({ order: [['dayOfWeek', 'ASC']] });
  return ok(res, rows.map(shapeSchedule));
});

// PUT /api/schedules  body: { days: [ {dayOfWeek, isOpen, openTime, closeTime, breakStart, breakEnd} x7 ] }
exports.updateSchedules = asyncHandler(async (req, res) => {
  const days = req.body && req.body.days;
  if (!Array.isArray(days) || days.length !== 7) {
    throw new AppError(400, 'Send all 7 days of the week', 'VALIDATION_ERROR');
  }

  const errors = {};
  const clean = days.map((d, i) => {
    const day = d && typeof d === 'object' ? d : {};
    const dow = Number(day.dayOfWeek);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) errors[`day${i}`] = 'Invalid day of week';
    const isOpen = day.isOpen === true;
    const out = { dayOfWeek: dow, isOpen };
    const label = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dow] || `Day ${i}`;

    const open = day.openTime || '09:00';
    const close = day.closeTime || '17:00';
    if (!isValidTimeStr(open) || !isValidTimeStr(close)) errors[`day${dow}`] = `${label}: use HH:MM times`;
    else if (isOpen && toMinutes(open) >= toMinutes(close)) errors[`day${dow}`] = `${label}: closing time must be after opening time`;
    out.openTime = open;
    out.closeTime = close;

    const hasBreak = day.breakStart || day.breakEnd;
    if (hasBreak) {
      if (!isValidTimeStr(day.breakStart) || !isValidTimeStr(day.breakEnd)) errors[`day${dow}`] = `${label}: enter both break start and end`;
      else if (toMinutes(day.breakStart) >= toMinutes(day.breakEnd)) errors[`day${dow}`] = `${label}: break end must be after break start`;
      else if (isOpen && (toMinutes(day.breakStart) < toMinutes(open) || toMinutes(day.breakEnd) > toMinutes(close))) errors[`day${dow}`] = `${label}: break must be inside opening hours`;
      out.breakStart = day.breakStart;
      out.breakEnd = day.breakEnd;
    } else {
      out.breakStart = null;
      out.breakEnd = null;
    }
    return out;
  });

  if (new Set(clean.map((d) => d.dayOfWeek)).size !== 7) errors.days = 'Each day of the week must appear exactly once';
  if (Object.keys(errors).length) throw new AppError(400, 'Please fix the opening hours', 'VALIDATION_ERROR', errors);

  await sequelize.transaction(async (transaction) => {
    for (const d of clean) {
      const existing = await ClinicSchedule.findOne({ where: { dayOfWeek: d.dayOfWeek }, transaction });
      if (existing) await existing.update(d, { transaction });
      else await ClinicSchedule.create(d, { transaction });
    }
  });

  const rows = await ClinicSchedule.findAll({ order: [['dayOfWeek', 'ASC']] });
  return ok(res, rows.map(shapeSchedule), 'Opening hours saved');
});

// ---- Holidays / closed dates ------------------------------------------------------

exports.listBlockedDates = asyncHandler(async (req, res) => {
  const from = isValidDateStr(req.query.from) ? req.query.from : manilaDate(new Date());
  const rows = await BlockedDate.findAll({ where: { date: { [Op.gte]: from } }, order: [['date', 'ASC']], limit: 500 });
  return ok(res, rows);
});

exports.createBlockedDate = asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  v.date('date', { label: 'Date' }).string('reason', { label: 'Reason', required: false, max: 255 });
  const data = v.done();

  if (await BlockedDate.findOne({ where: { date: data.date } })) {
    throw new AppError(409, 'That date is already blocked', 'DUPLICATE', { date: 'Already blocked' });
  }
  const row = await BlockedDate.create(data);

  // Warn the admin about bookings that already exist on that day (they are not cancelled automatically).
  const [from, to] = dayRange(data.date);
  const affected = await Appointment.count({ where: { status: { [Op.in]: ACTIVE_STATUSES }, startAt: { [Op.gte]: from, [Op.lt]: to } } });
  return created(res, { ...row.toJSON(), affectedAppointments: affected },
    affected > 0
      ? `Date blocked. ${affected} existing appointment(s) on this day need to be rescheduled or cancelled by staff.`
      : 'Date blocked');
});

exports.deleteBlockedDate = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'blocked date ID');
  const row = await BlockedDate.findByPk(id);
  if (!row) throw new AppError(404, 'Blocked date not found', 'NOT_FOUND');
  await row.destroy(); // configuration data, not booking history, so a real delete is fine
  return ok(res, null, 'Date is open again');
});

// ---- Booking rules ----------------------------------------------------------------

exports.getSettings = asyncHandler(async (req, res) => ok(res, await getSettings()));

exports.updateSettings = asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  const labels = {
    slotIntervalMinutes: 'Slot interval (minutes)',
    minNoticeHours: 'Minimum notice (hours)',
    maxAdvanceDays: 'Booking window (days)',
    cancellationCutoffHours: 'Cancellation cutoff (hours)',
    maxActivePerPatient: 'Open appointments per patient',
  };
  Object.entries(LIMITS).forEach(([key, [min, max]]) => v.integer(key, { label: labels[key], min, max }));
  const data = v.done();

  await sequelize.transaction(async (transaction) => {
    for (const [key, value] of Object.entries(data)) {
      await Setting.upsert({ key, value: String(value) }, { transaction });
    }
  });
  return ok(res, await getSettings(), 'Booking rules saved');
});
