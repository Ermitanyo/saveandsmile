const { Service } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { parseId } = require('../utils/validate');
const { isValidDateStr, isValidMonthStr } = require('../utils/time');
const { getSlotsForDate, getAvailableDates } = require('../services/availabilityService');

async function loadService(raw) {
  const service = await Service.findByPk(parseId(raw, 'service ID'));
  if (!service || !service.isActive) throw new AppError(404, 'Service not found or not available', 'NOT_FOUND');
  return service;
}

const isStaff = (req) => Boolean(req.user && (req.user.role === 'staff' || req.user.role === 'admin'));

// Staff rescheduling an appointment can ask to ignore that appointment's own time.
const excludeId = (req) => (isStaff(req) && req.query.excludeAppointmentId ? parseId(req.query.excludeAppointmentId, 'appointment ID') : null);

// GET /api/availability/dates?serviceId=1&month=2026-11
exports.dates = asyncHandler(async (req, res) => {
  const service = await loadService(req.query.serviceId);
  if (!isValidMonthStr(req.query.month)) throw new AppError(400, 'month must look like 2026-11', 'VALIDATION_ERROR', { month: 'Invalid month' });
  const dates = await getAvailableDates({ service, month: req.query.month, bypassRules: isStaff(req), excludeAppointmentId: excludeId(req) });
  return ok(res, { serviceId: service.id, month: req.query.month, dates });
});

// GET /api/availability/slots?serviceId=1&date=2026-11-05
exports.slots = asyncHandler(async (req, res) => {
  const service = await loadService(req.query.serviceId);
  if (!isValidDateStr(req.query.date)) throw new AppError(400, 'date must look like 2026-11-05', 'VALIDATION_ERROR', { date: 'Invalid date' });
  const slots = await getSlotsForDate({ service, date: req.query.date, bypassRules: isStaff(req), excludeAppointmentId: excludeId(req) });
  return ok(res, { serviceId: service.id, date: req.query.date, slots });
});
