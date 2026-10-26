// Runs with plain Node: `npm test`. No database or packages needed.
const test = require('node:test');
const assert = require('node:assert');
const T = require('../utils/time');
const { computeSlots } = require('../services/slotEngine');
const { checkTransition, allowedNextStatuses } = require('../services/statusRules');
const { Validator, parseId } = require('../utils/validate');

const settings = { slotIntervalMinutes: 30, minNoticeHours: 2, maxAdvanceDays: 60, cancellationCutoffHours: 24 };
const openDay = { isOpen: true, openTime: '09:00:00', closeTime: '20:00:00', breakStart: null, breakEnd: null };
const NOW = new Date('2026-11-02T00:00:00+08:00'); // Monday 12:00 AM Manila

const base = (over = {}) => ({
  date: '2026-11-03', durationMinutes: 30, schedule: openDay, isBlocked: false,
  appointments: [], settings, now: NOW, bypassRules: false, ...over,
});

test('time helpers use Philippine time (UTC+8)', () => {
  assert.strictEqual(T.toInstant('2026-11-03', '09:00').toISOString(), '2026-11-03T01:00:00.000Z');
  assert.strictEqual(T.manilaDate(new Date('2026-11-02T17:00:00Z')), '2026-11-03'); // 1 AM next day in Manila
  assert.strictEqual(T.manilaTime(new Date('2026-11-03T01:00:00Z')), '09:00');
  assert.strictEqual(T.dayOfWeek('2026-11-03'), 2); // Tuesday
  assert.strictEqual(T.addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(T.datesInMonth('2026-02').length, 28);
  assert.ok(!T.isValidDateStr('2026-02-30'));
  assert.ok(T.isValidTimeStr('23:59') && !T.isValidTimeStr('24:00'));
});

test('full open day gives a slot every 30 min from 09:00 to 19:30 (30-min service)', () => {
  const s = computeSlots(base());
  assert.strictEqual(s.length, 22);
  assert.strictEqual(s[0].startTime, '09:00');
  assert.strictEqual(s[s.length - 1].startTime, '19:30');
  assert.strictEqual(s[s.length - 1].endTime, '20:00');
});

test('longer services stop earlier so they finish before closing', () => {
  const s = computeSlots(base({ durationMinutes: 90 }));
  assert.strictEqual(s[s.length - 1].startTime, '18:30');
});

test('closed day, blocked date and past dates have no slots', () => {
  assert.deepStrictEqual(computeSlots(base({ schedule: { ...openDay, isOpen: false } })), []);
  assert.deepStrictEqual(computeSlots(base({ isBlocked: true })), []);
  assert.deepStrictEqual(computeSlots(base({ date: '2026-11-01' })), []);
  assert.deepStrictEqual(computeSlots(base({ date: '2027-03-01' })), []); // beyond 60 days
});

test('lunch break removes overlapping slots', () => {
  const sched = { ...openDay, breakStart: '12:00', breakEnd: '13:00' };
  const times = computeSlots(base({ schedule: sched, durationMinutes: 60 })).map((s) => s.startTime);
  assert.ok(!times.includes('11:30') && !times.includes('12:00') && !times.includes('12:30'));
  assert.ok(times.includes('11:00') && times.includes('13:00'));
});

test('existing appointments block overlapping slots but not adjacent ones', () => {
  const appt = { startAt: T.toInstant('2026-11-03', '10:00'), endAt: T.toInstant('2026-11-03', '11:00') };
  const times = computeSlots(base({ appointments: [appt], durationMinutes: 60 })).map((s) => s.startTime);
  assert.ok(!times.includes('09:30') && !times.includes('10:00') && !times.includes('10:30'));
  assert.ok(times.includes('09:00') && times.includes('11:00'));
});

test('minimum notice hides near-future slots for patients, staff can still book them', () => {
  const now = new Date('2026-11-03T10:10:00+08:00');
  const patient = computeSlots(base({ now })).map((s) => s.startTime);
  assert.strictEqual(patient[0], '12:30'); // 10:10 + 2h = 12:10 -> next slot 12:30
  const staff = computeSlots(base({ now, bypassRules: true })).map((s) => s.startTime);
  assert.strictEqual(staff[0], '10:00'); // 10:00-10:30 is still in progress
});

test('status transitions: patients cannot confirm or complete', () => {
  const appt = { status: 'pending', startAt: '2026-11-10T02:00:00Z' };
  const r = checkTransition({ appointment: appt, to: 'confirmed', role: 'patient', settings, now: NOW });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.status, 403);
  assert.strictEqual(checkTransition({ appointment: appt, to: 'confirmed', role: 'staff', settings, now: NOW }).ok, true);
  assert.strictEqual(checkTransition({ appointment: appt, to: 'completed', role: 'staff', settings, now: NOW }).status, 409);
});

test('final statuses cannot change', () => {
  for (const status of ['completed', 'cancelled', 'no_show']) {
    const r = checkTransition({ appointment: { status, startAt: '2026-11-01T02:00:00Z' }, to: 'confirmed', role: 'admin', settings, now: NOW });
    assert.strictEqual(r.ok, false); assert.strictEqual(r.code, 'INVALID_TRANSITION');
  }
});

test('patient cancellation cutoff applies to confirmed appointments only', () => {
  const soon = '2026-11-02T10:00:00Z'; // 10 hours after NOW
  const confirmed = { status: 'confirmed', startAt: soon };
  const pending = { status: 'pending', startAt: soon };
  assert.strictEqual(checkTransition({ appointment: confirmed, to: 'cancelled', role: 'patient', settings, now: NOW }).code, 'CANCELLATION_TOO_LATE');
  assert.strictEqual(checkTransition({ appointment: pending, to: 'cancelled', role: 'patient', settings, now: NOW }).ok, true);
  assert.strictEqual(checkTransition({ appointment: confirmed, to: 'cancelled', role: 'staff', settings, now: NOW }).ok, true);
});

test('completed / no-show cannot be recorded before the appointment day', () => {
  const future = { status: 'confirmed', startAt: '2026-11-10T02:00:00Z' };
  const today = { status: 'confirmed', startAt: '2026-11-02T05:00:00Z' }; // 1 PM Manila today
  assert.strictEqual(checkTransition({ appointment: future, to: 'no_show', role: 'staff', settings, now: NOW }).code, 'TOO_EARLY');
  assert.strictEqual(checkTransition({ appointment: today, to: 'completed', role: 'staff', settings, now: NOW }).ok, true);
  assert.deepStrictEqual(allowedNextStatuses({ appointment: future, role: 'staff', settings, now: NOW }).sort(), ['cancelled']);
});

test('Validator collects all errors and parseId rejects bad ids', () => {
  const v = new Validator({ name: '', email: 'nope', password: 'short' });
  v.string('name', { label: 'Name' }).email().password();
  assert.throws(() => v.done(), (e) => e.status === 400 && Boolean(e.errors.name && e.errors.email && e.errors.password));
  const ok = new Validator({ name: ' Ana ', email: 'ANA@Mail.com', password: 'abcdefg1' });
  assert.deepStrictEqual(ok.string('name').email().password().done(), { name: 'Ana', email: 'ana@mail.com', password: 'abcdefg1' });
  assert.throws(() => parseId('abc'));
  assert.throws(() => parseId('0'));
  assert.throws(() => parseId('99999999999'));
  assert.strictEqual(parseId('12'), 12);
});
