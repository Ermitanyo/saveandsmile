const { Op } = require('sequelize');
const models = require('../models');
const { Appointment, Service, User, Notification } = models;
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { manilaDate, dayRange, toInstant, addDays } = require('../utils/time');
const { getSettings } = require('../services/settingsService');
const { serializeAppointment, appointmentIncludes } = require('../services/appointmentSerializer');

exports.patient = asyncHandler(async (req, res) => {
  const now = new Date();
  const settings = await getSettings();
  const rows = await Appointment.findAll({
    where: { patientId: req.user.id },
    include: appointmentIncludes(models),
    order: [['startAt', 'ASC']],
    limit: 500,
  });
  const all = rows.map((r) => serializeAppointment(r, req.user, settings, now));
  const isUpcoming = (a) => ['pending', 'confirmed', 'rescheduled'].includes(a.status) && new Date(a.endAt) > now;

  const upcoming = all.filter(isUpcoming);
  const history = all.filter((a) => !isUpcoming(a)).reverse(); // newest first
  const unreadNotifications = await Notification.count({ where: { userId: req.user.id, isRead: false } });
  return ok(res, { upcoming, history, unreadNotifications });
});

// Used by staff and admin. Admin also gets a per-service breakdown.
exports.staff = asyncHandler(async (req, res) => {
  const now = new Date();
  const settings = await getSettings();
  const today = manilaDate(now);
  const [todayStart, todayEnd] = dayRange(today);
  const monthStr = today.slice(0, 7);
  const monthStart = toInstant(`${monthStr}-01`, '00:00');
  const nextMonthStart = toInstant(`${addDays(`${monthStr}-28`, 4).slice(0, 7)}-01`, '00:00');
  const include = appointmentIncludes(models);

  const [todayRows, pendingRows, monthRows, totalPatients, upcomingCount] = await Promise.all([
    Appointment.findAll({ where: { startAt: { [Op.gte]: todayStart, [Op.lt]: todayEnd } }, include, order: [['startAt', 'ASC']] }),
    Appointment.findAll({ where: { status: 'pending' }, include, order: [['startAt', 'ASC']], limit: 100 }),
    Appointment.findAll({ where: { startAt: { [Op.gte]: monthStart, [Op.lt]: nextMonthStart } }, attributes: ['status', 'serviceId'] }),
    User.count({ where: { role: 'patient', isActive: true } }),
    Appointment.count({ where: { status: { [Op.in]: ['confirmed', 'rescheduled'] }, startAt: { [Op.gte]: now } } }),
  ]);

  const month = { pending: 0, confirmed: 0, rescheduled: 0, completed: 0, cancelled: 0, no_show: 0, total: 0 };
  const perService = new Map();
  monthRows.forEach((r) => {
    month[r.status] += 1;
    month.total += 1;
    if (r.status !== 'cancelled') perService.set(r.serviceId, (perService.get(r.serviceId) || 0) + 1);
  });

  const data = {
    today,
    todayAppointments: todayRows.map((r) => serializeAppointment(r, req.user, settings, now)),
    pendingRequests: pendingRows.map((r) => serializeAppointment(r, req.user, settings, now)),
    stats: { month, totalPatients, upcomingConfirmed: upcomingCount },
  };

  if (req.user.role === 'admin') {
    const services = await Service.findAll({ attributes: ['id', 'name'] });
    data.byService = services
      .map((s) => ({ serviceId: s.id, name: s.name, count: perService.get(s.id) || 0 }))
      .sort((a, b) => b.count - a.count);
  }
  return ok(res, data);
});
