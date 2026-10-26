// Pure appointment-status rules (no database), enforced by the backend.
const { manilaDate } = require('../utils/time');

const STAFF_ROLES = ['staff', 'admin'];

// from -> to -> roles that may perform it
const TRANSITIONS = {
  pending: {
    confirmed: STAFF_ROLES,
    cancelled: ['patient', 'staff', 'admin'],
  },
  confirmed: {
    completed: STAFF_ROLES,
    no_show: STAFF_ROLES,
    cancelled: ['patient', 'staff', 'admin'],
  },
  rescheduled: {
    confirmed: STAFF_ROLES,
    completed: STAFF_ROLES,
    no_show: STAFF_ROLES,
    cancelled: ['patient', 'staff', 'admin'],
  },
  completed: {},
  cancelled: {},
  no_show: {},
};

const ALL_STATUSES = Object.keys(TRANSITIONS);
const RESCHEDULABLE = ['pending', 'confirmed', 'rescheduled'];

/**
 * Decide whether `role` may move an appointment to `to` right now.
 * Returns { ok: true } or { ok: false, status, code, message }.
 */
function checkTransition({ appointment, to, role, settings, now }) {
  const from = appointment.status;
  if (!ALL_STATUSES.includes(to)) {
    return { ok: false, status: 400, code: 'INVALID_STATUS', message: 'Unknown appointment status' };
  }

  const roles = TRANSITIONS[from] && TRANSITIONS[from][to];
  if (!roles) {
    return {
      ok: false, status: 409, code: 'INVALID_TRANSITION',
      message: `An appointment that is "${from}" cannot be changed to "${to}"`,
    };
  }
  if (!roles.includes(role)) {
    return { ok: false, status: 403, code: 'FORBIDDEN_TRANSITION', message: 'You are not allowed to make this change' };
  }

  // Patients: confirmed/rescheduled appointments can only be cancelled before the cutoff.
  if (role === 'patient' && to === 'cancelled' && from !== 'pending') {
    const hoursLeft = (new Date(appointment.startAt).getTime() - now.getTime()) / 3600000;
    if (hoursLeft < settings.cancellationCutoffHours) {
      return {
        ok: false, status: 409, code: 'CANCELLATION_TOO_LATE',
        message: `Confirmed appointments can only be cancelled online at least ${settings.cancellationCutoffHours} hours before. Please contact the clinic.`,
      };
    }
  }

  // Completed / no-show can only be recorded on or after the appointment day.
  if ((to === 'completed' || to === 'no_show') && manilaDate(new Date(appointment.startAt)) > manilaDate(now)) {
    return {
      ok: false, status: 409, code: 'TOO_EARLY',
      message: 'Completed or no-show can only be recorded on or after the appointment day',
    };
  }

  return { ok: true };
}

// Statuses the given role could choose right now (used to draw buttons in the UI).
function allowedNextStatuses({ appointment, role, settings, now }) {
  return Object.keys(TRANSITIONS[appointment.status] || {}).filter(
    (to) => checkTransition({ appointment, to, role, settings, now }).ok
  );
}

module.exports = { TRANSITIONS, ALL_STATUSES, RESCHEDULABLE, checkTransition, allowedNextStatuses };
