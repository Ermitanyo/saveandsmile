const { manilaDate, manilaTime } = require('../utils/time');
const { allowedNextStatuses, RESCHEDULABLE } = require('./statusRules');

// Turns an Appointment (with patient + service loaded) into the JSON the frontend uses.
// Adds clinic-local date/time strings and the actions this viewer is allowed to take,
// so the frontend never has to guess the rules.
function serializeAppointment(appointment, viewer, settings, now = new Date()) {
  const a = appointment.toJSON();
  const start = new Date(a.startAt);
  const end = new Date(a.endAt);
  const isStaff = viewer.role === 'staff' || viewer.role === 'admin';

  const out = {
    ...a,
    date: manilaDate(start),
    startTime: manilaTime(start),
    endTime: manilaTime(end),
    allowedStatuses: allowedNextStatuses({ appointment: a, role: viewer.role, settings, now }),
    canReschedule: isStaff && RESCHEDULABLE.includes(a.status),
  };
  if (!isStaff) delete out.staffNotes; // clinic-only notes are hidden from patients
  return out;
}

const appointmentIncludes = (models) => [
  { model: models.User, as: 'patient', attributes: ['id', 'name', 'email', 'phone'] },
  { model: models.Service, as: 'service', attributes: ['id', 'name', 'durationMinutes'] },
];

module.exports = { serializeAppointment, appointmentIncludes };
