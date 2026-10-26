const { Notification } = require('../models');
const { manilaDate, manilaTime } = require('../utils/time');

const fmtWhen = (startAt) => {
  const d = new Date(startAt);
  return `${manilaDate(d)} at ${manilaTime(d)}`;
};

function messageFor(status, appointment, serviceName, extra = {}) {
  const what = `${serviceName} on ${fmtWhen(appointment.startAt)}`;
  switch (status) {
    case 'pending': return `Your appointment request for ${what} was received. The clinic will confirm it soon.`;
    case 'confirmed': return `Your appointment for ${what} is confirmed.`;
    case 'rescheduled': return `Your appointment was moved to ${what}. Please contact the clinic if this time does not work for you.`;
    case 'completed': return `Your appointment for ${what} was marked completed. Thank you for visiting SaveandSmile!`;
    case 'no_show': return `Your appointment for ${what} was marked as a no-show.`;
    case 'cancelled': return extra.declined
      ? `Your appointment request for ${what} could not be accepted${extra.reason ? `: ${extra.reason}` : '.'}`
      : `Your appointment for ${what} was cancelled${extra.reason ? `: ${extra.reason}` : '.'}`;
    default: return `Your appointment for ${what} was updated.`;
  }
}

async function notifyPatient({ appointment, serviceName, status, extra, transaction }) {
  return Notification.create(
    {
      userId: appointment.patientId,
      appointmentId: appointment.id,
      message: messageFor(status, appointment, serviceName, extra),
    },
    transaction ? { transaction } : {}
  );
}

module.exports = { notifyPatient, messageFor };
