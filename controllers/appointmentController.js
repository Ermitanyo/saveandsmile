const { Op } = require('sequelize');
const models = require('../models');
const { sequelize, Appointment, Service, User } = models;
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/respond');
const { Validator, parseId } = require('../utils/validate');
const { isValidDateStr, dayRange } = require('../utils/time');
const { getSlotsForDate } = require('../services/availabilityService');
const { getSettings } = require('../services/settingsService');
const { notifyPatient } = require('../services/notificationService');
const { checkTransition, RESCHEDULABLE } = require('../services/statusRules');
const { serializeAppointment, appointmentIncludes } = require('../services/appointmentSerializer');
const { isStaffRole } = require('../middleware/auth');

// One fixed number used as a PostgreSQL advisory-lock key. While a booking transaction holds it,
// other booking transactions wait, so two people can never be checked against the same "free" slot.
const BOOKING_LOCK_KEY = 74120001;

const lockBookings = (transaction) =>
  sequelize.query('SELECT pg_advisory_xact_lock(:key)', { replacements: { key: BOOKING_LOCK_KEY }, transaction });

// Loads one appointment the viewer is allowed to see (patients only see their own).
async function loadAppointment(req, options = {}) {
  const id = parseId(req.params.id, 'appointment ID');
  const where = { id };
  if (!isStaffRole(req.user)) where.patientId = req.user.id;
  const appointment = await Appointment.findOne({ where, include: appointmentIncludes(models), ...options });
  if (!appointment) throw new AppError(404, 'Appointment not found', 'NOT_FOUND');
  return appointment;
}

const present = async (appointment, user) =>
  serializeAppointment(appointment, user, await getSettings());

// ---- Create -----------------------------------------------------------------------

exports.create = asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  v.integer('serviceId', { label: 'Service' }).date('date', { label: 'Date' })
    .time('startTime', { label: 'Time' }).string('notes', { label: 'Notes', required: false, max: 500 });
  const staff = isStaffRole(req.user);
  if (staff) v.integer('patientId', { label: 'Patient' });
  const data = v.done();
  const patientId = staff ? data.patientId : req.user.id;

  const service = await Service.findByPk(data.serviceId);
  if (!service || !service.isActive) throw new AppError(404, 'Service not found or not available', 'NOT_FOUND');
  if (staff) {
    const patient = await User.findOne({ where: { id: patientId, role: 'patient', isActive: true } });
    if (!patient) throw new AppError(404, 'Patient not found', 'NOT_FOUND');
  }

  const appointment = await sequelize.transaction(async (transaction) => {
    await lockBookings(transaction);
    const settings = await getSettings({ transaction });

    if (!staff) {
      const open = await Appointment.count({
        where: { patientId, status: { [Op.in]: ['pending', 'confirmed', 'rescheduled'] }, startAt: { [Op.gte]: new Date() } },
        transaction,
      });
      if (open >= settings.maxActivePerPatient) {
        throw new AppError(409, `You can have at most ${settings.maxActivePerPatient} open appointments at a time`, 'BOOKING_LIMIT');
      }
    }

    // Re-check availability on the server. The browser's list may be out of date.
    const slots = await getSlotsForDate({ service, date: data.date, bypassRules: staff, transaction });
    if (!slots.some((s) => s.startTime === data.startTime)) {
      throw new AppError(409, 'That time is no longer available. Please choose another time.', 'SLOT_UNAVAILABLE');
    }

    const slot = slots.find((s) => s.startTime === data.startTime);
    const row = await Appointment.create({
      patientId,
      serviceId: service.id,
      startAt: new Date(slot.startAt),
      endAt: new Date(slot.endAt),
      // Staff-entered bookings (walk-ins, phone calls) are confirmed right away; online requests wait for approval.
      status: staff ? 'confirmed' : 'pending',
      notes: data.notes,
      createdById: req.user.id,
    }, { transaction });

    await notifyPatient({ appointment: row, serviceName: service.name, status: row.status, transaction });
    return row;
  });

  const full = await Appointment.findByPk(appointment.id, { include: appointmentIncludes(models) });
  return created(res, await present(full, req.user),
    staff ? 'Appointment booked and confirmed' : 'Appointment request sent. The clinic will confirm it soon.');
});

// ---- List / read ------------------------------------------------------------------

exports.list = asyncHandler(async (req, res) => {
  const staff = isStaffRole(req.user);
  const where = {};
  if (!staff) where.patientId = req.user.id;

  const { status, from, to, search, patientId, order } = req.query;

  if (status) {
    const list = String(status).split(',').map((s) => s.trim()).filter(Boolean);
    if (list.some((s) => !Appointment.STATUSES.includes(s))) throw new AppError(400, 'Unknown status filter', 'VALIDATION_ERROR');
    where.status = { [Op.in]: list };
  }
  if (from !== undefined && !isValidDateStr(from)) throw new AppError(400, 'from must be a date like 2026-11-05', 'VALIDATION_ERROR');
  if (to !== undefined && !isValidDateStr(to)) throw new AppError(400, 'to must be a date like 2026-11-05', 'VALIDATION_ERROR');
  if (from || to) {
    where.startAt = {};
    if (from) where.startAt[Op.gte] = dayRange(from)[0];
    if (to) where.startAt[Op.lt] = dayRange(to)[1];
  }
  if (staff && patientId !== undefined) where.patientId = parseId(patientId, 'patient ID');

  const include = appointmentIncludes(models);
  if (staff && typeof search === 'string' && search.trim()) {
    const like = { [Op.iLike]: `%${search.trim().slice(0, 80).replace(/[%_\\]/g, '\\$&')}%` };
    include[0] = { ...include[0], where: { [Op.or]: [{ name: like }, { email: like }, { phone: like }] }, required: true };
  }

  const rows = await Appointment.findAll({
    where, include, order: [['startAt', order === 'desc' ? 'DESC' : 'ASC']], limit: 500,
  });
  const settings = await getSettings();
  return ok(res, rows.map((r) => serializeAppointment(r, req.user, settings)));
});

exports.getOne = asyncHandler(async (req, res) => {
  const appointment = await loadAppointment(req);
  return ok(res, await present(appointment, req.user));
});

// ---- Status changes ---------------------------------------------------------------

exports.changeStatus = asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  v.oneOf('status', Appointment.STATUSES).string('reason', { label: 'Reason', required: false, max: 255 });
  const data = v.done();

  const appointment = await loadAppointment(req);
  const settings = await getSettings();
  const result = checkTransition({ appointment, to: data.status, role: req.user.role, settings, now: new Date() });
  if (!result.ok) throw new AppError(result.status, result.message, result.code);

  const previous = appointment.status;
  const changes = { status: data.status };
  if (data.status === 'cancelled') {
    changes.cancelledBy = req.user.role;
    changes.cancelReason = data.reason;
  }
  await appointment.update(changes);

  // Tell the patient when the clinic changed something (patients already know what they just did).
  if (isStaffRole(req.user)) {
    await notifyPatient({
      appointment, serviceName: appointment.service.name, status: data.status,
      extra: { reason: data.reason, declined: previous === 'pending' && data.status === 'cancelled' },
    });
  }
  return ok(res, await present(appointment, req.user), 'Appointment updated');
});

// ---- Reschedule (staff) -----------------------------------------------------------

exports.reschedule = asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  v.date('date', { label: 'Date' }).time('startTime', { label: 'Time' });
  const data = v.done();

  const appointment = await sequelize.transaction(async (transaction) => {
    await lockBookings(transaction);
    const current = await loadAppointment(req, { transaction });
    if (!RESCHEDULABLE.includes(current.status)) {
      throw new AppError(409, `A ${current.status} appointment cannot be rescheduled`, 'INVALID_TRANSITION');
    }

    const slots = await getSlotsForDate({
      service: current.service, date: data.date, bypassRules: true, excludeAppointmentId: current.id, transaction,
    });
    const slot = slots.find((s) => s.startTime === data.startTime);
    if (!slot) throw new AppError(409, 'That time is not available', 'SLOT_UNAVAILABLE');

    await current.update({ startAt: new Date(slot.startAt), endAt: new Date(slot.endAt), status: 'rescheduled' }, { transaction });
    await notifyPatient({ appointment: current, serviceName: current.service.name, status: 'rescheduled', transaction });
    return current;
  });

  return ok(res, await present(appointment, req.user), 'Appointment rescheduled');
});

// ---- Clinic notes (staff) ---------------------------------------------------------

exports.updateNotes = asyncHandler(async (req, res) => {
  const { staffNotes } = new Validator(req.body).string('staffNotes', { label: 'Notes', required: false, max: 1000 }).done();
  const appointment = await loadAppointment(req);
  await appointment.update({ staffNotes });
  return ok(res, await present(appointment, req.user), 'Notes saved');
});
