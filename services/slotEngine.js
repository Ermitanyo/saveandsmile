// Pure availability logic (no database access) so it can be unit-tested on its own.
// Both the "show available slots" screen and the "book this slot" request use this
// same function, so the backend never trusts the browser about what is free.
const {
  toMinutes, fromMinutes, toInstant, dayOfWeek, manilaDate, addDays, normTime,
} = require('../utils/time');

const ACTIVE_STATUSES = ['pending', 'confirmed', 'rescheduled'];

const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

/**
 * @param {object}  p
 * @param {string}  p.date             "YYYY-MM-DD" (clinic local date)
 * @param {number}  p.durationMinutes  length of the chosen service
 * @param {object}  p.schedule         { isOpen, openTime, closeTime, breakStart, breakEnd } for that weekday
 * @param {boolean} p.isBlocked        true when the date is a holiday / closed date
 * @param {Array}   p.appointments     active appointments that day: [{ startAt: Date, endAt: Date }]
 * @param {object}  p.settings         { slotIntervalMinutes, minNoticeHours, maxAdvanceDays }
 * @param {Date}    p.now
 * @param {boolean} p.bypassRules      true for clinic staff (walk-ins): skips minimum notice and advance limit
 * @returns {Array<{ startTime, endTime, startAt, endAt }>}
 */
function computeSlots({
  date, durationMinutes, schedule, isBlocked, appointments, settings, now, bypassRules = false,
}) {
  if (isBlocked || !schedule || !schedule.isOpen) return [];

  const today = manilaDate(now);
  if (date < today) return [];
  if (!bypassRules && date > addDays(today, settings.maxAdvanceDays)) return [];

  const open = toMinutes(normTime(schedule.openTime));
  const close = toMinutes(normTime(schedule.closeTime));
  const bStart = schedule.breakStart ? toMinutes(normTime(schedule.breakStart)) : null;
  const bEnd = schedule.breakEnd ? toMinutes(normTime(schedule.breakEnd)) : null;
  const interval = settings.slotIntervalMinutes;
  const earliest = now.getTime() + settings.minNoticeHours * 3600 * 1000;

  const slots = [];
  for (let start = open; start + durationMinutes <= close; start += interval) {
    const end = start + durationMinutes;

    // lunch / break
    if (bStart !== null && bEnd !== null && overlaps(start, end, bStart, bEnd)) continue;

    const startAt = toInstant(date, fromMinutes(start));
    const endAt = toInstant(date, fromMinutes(end));

    if (bypassRules) {
      if (endAt.getTime() <= now.getTime()) continue; // already over
    } else if (startAt.getTime() < earliest) {
      continue; // too soon (minimum notice) or in the past
    }

    if (appointments.some((a) => overlaps(startAt, endAt, a.startAt, a.endAt))) continue;

    slots.push({
      startTime: fromMinutes(start),
      endTime: fromMinutes(end),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });
  }
  return slots;
}

// Weekday helper used by the database wrapper
const weekdayOf = dayOfWeek;

module.exports = { computeSlots, ACTIVE_STATUSES, overlaps, weekdayOf };
