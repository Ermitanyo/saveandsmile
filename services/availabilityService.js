// Database-backed availability: loads hours, blocked dates and existing appointments,
// then hands them to the pure slot engine.
const { Op } = require('sequelize');
const { ClinicSchedule, BlockedDate, Appointment } = require('../models');
const { computeSlots, ACTIVE_STATUSES, weekdayOf } = require('./slotEngine');
const { getSettings } = require('./settingsService');
const { dayRange, toInstant, datesInMonth, addDays } = require('../utils/time');

async function getSlotsForDate({ service, date, bypassRules = false, excludeAppointmentId = null, transaction, now = new Date() }) {
  const opts = transaction ? { transaction } : {};
  const [settings, schedule, blocked] = await Promise.all([
    getSettings(opts),
    ClinicSchedule.findOne({ where: { dayOfWeek: weekdayOf(date) }, ...opts }),
    BlockedDate.findOne({ where: { date }, ...opts }),
  ]);

  const [from, to] = dayRange(date);
  const where = { status: { [Op.in]: ACTIVE_STATUSES }, startAt: { [Op.lt]: to }, endAt: { [Op.gt]: from } };
  if (excludeAppointmentId) where.id = { [Op.ne]: excludeAppointmentId };
  const appointments = await Appointment.findAll({ where, attributes: ['startAt', 'endAt'], ...opts });

  return computeSlots({
    date,
    durationMinutes: service.durationMinutes,
    schedule,
    isBlocked: Boolean(blocked),
    appointments,
    settings,
    now,
    bypassRules,
  });
}

// For the calendar: which dates in a month still have at least one free slot?
async function getAvailableDates({ service, month, bypassRules = false, excludeAppointmentId = null, now = new Date() }) {
  const dates = datesInMonth(month);
  const [settings, schedules, blockedRows] = await Promise.all([
    getSettings(),
    ClinicSchedule.findAll(),
    BlockedDate.findAll({ where: { date: { [Op.between]: [dates[0], dates[dates.length - 1]] } } }),
  ]);
  const blocked = new Set(blockedRows.map((b) => b.date));
  const byDay = new Map(schedules.map((s) => [s.dayOfWeek, s]));

  const from = toInstant(dates[0], '00:00');
  const to = toInstant(addDays(dates[dates.length - 1], 1), '00:00');
  const where = { status: { [Op.in]: ACTIVE_STATUSES }, startAt: { [Op.lt]: to }, endAt: { [Op.gt]: from } };
  if (excludeAppointmentId) where.id = { [Op.ne]: excludeAppointmentId };
  const appointments = await Appointment.findAll({ where, attributes: ['startAt', 'endAt'] });

  return dates.filter((date) => {
    const [dayStart, dayEnd] = dayRange(date);
    const dayAppointments = appointments.filter((a) => a.startAt < dayEnd && a.endAt > dayStart);
    return computeSlots({
      date,
      durationMinutes: service.durationMinutes,
      schedule: byDay.get(weekdayOf(date)),
      isBlocked: blocked.has(date),
      appointments: dayAppointments,
      settings,
      now,
      bypassRules,
    }).length > 0;
  });
}

module.exports = { getSlotsForDate, getAvailableDates };
