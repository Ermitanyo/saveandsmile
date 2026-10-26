const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { sequelize, User, PatientProfile, Appointment, Service } = require('../models');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/respond');
const { Validator, parseId } = require('../utils/validate');
const { parseProfile } = require('../utils/profileFields');
const { manilaDate, manilaTime } = require('../utils/time');

// Saves the profile form. Creates the row if it does not exist yet.
async function saveProfile(userId, profileInput, transaction) {
  if (!profileInput || typeof profileInput !== 'object') return;
  const data = parseProfile(profileInput);
  if (data.privacyConsent === true) data.privacyConsentAt = new Date();
  const existing = await PatientProfile.findOne({ where: { userId }, transaction });
  if (existing) {
    // Once given, privacy consent is not silently removed by a partial save.
    if (existing.privacyConsent && data.privacyConsent !== false) delete data.privacyConsentAt;
    await existing.update(data, { transaction });
  } else {
    await PatientProfile.create({ ...data, userId }, { transaction });
  }
}

// ---- Current user -----------------------------------------------------------------

exports.getMe = asyncHandler(async (req, res) => {
  const profile = req.user.role === 'patient' ? await PatientProfile.findOne({ where: { userId: req.user.id } }) : null;
  return ok(res, { user: req.user.toJSON(), profile });
});

exports.updateMe = asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  v.string('name', { label: 'Full name', min: 2, max: 120 }).phone();
  const data = v.done();

  await sequelize.transaction(async (transaction) => {
    await req.user.update({ name: data.name, phone: data.phone }, { transaction });
    if (req.user.role === 'patient') await saveProfile(req.user.id, req.body.profile, transaction);
  });

  const profile = req.user.role === 'patient' ? await PatientProfile.findOne({ where: { userId: req.user.id } }) : null;
  return ok(res, { user: req.user.toJSON(), profile }, 'Profile updated');
});

// ---- Patients (staff / admin) -----------------------------------------------------

exports.listPatients = asyncHandler(async (req, res) => {
  const where = { role: 'patient' };
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
  if (search) {
    const like = { [Op.iLike]: `%${search.replace(/[%_\\]/g, '\\$&')}%` };
    where[Op.or] = [{ name: like }, { email: like }, { phone: like }];
  }
  const rows = await User.scope('withPassword').findAll({ where, order: [['name', 'ASC']], limit: 300 });
  const patients = rows.map((u) => ({ ...u.toJSON(), hasAccount: Boolean(u.passwordHash) }));
  return ok(res, patients);
});

exports.createPatient = asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  v.string('name', { label: 'Full name', min: 2, max: 120 }).phone().email('email', { required: false });
  const data = v.done();

  if (data.email && (await User.findOne({ where: { email: data.email } }))) {
    throw new AppError(409, 'A patient with this email already exists', 'EMAIL_TAKEN', { email: 'This email is already registered' });
  }

  const user = await sequelize.transaction(async (transaction) => {
    const u = await User.create({ name: data.name, email: data.email, phone: data.phone, role: 'patient' }, { transaction });
    await PatientProfile.create({ userId: u.id }, { transaction });
    await saveProfile(u.id, req.body.profile, transaction);
    return u;
  });

  const profile = await PatientProfile.findOne({ where: { userId: user.id } });
  return created(res, { user: user.toJSON(), profile }, 'Patient registered');
});

exports.getPatient = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'patient ID');
  const user = await User.scope('withPassword').findOne({ where: { id, role: 'patient' } });
  if (!user) throw new AppError(404, 'Patient not found', 'NOT_FOUND');

  const [profile, appointments] = await Promise.all([
    PatientProfile.findOne({ where: { userId: id } }),
    Appointment.findAll({
      where: { patientId: id },
      include: [{ model: Service, as: 'service', attributes: ['id', 'name'] }],
      order: [['startAt', 'DESC']],
      limit: 30,
    }),
  ]);

  const history = appointments.map((a) => ({
    id: a.id, status: a.status, service: a.service ? a.service.name : null,
    date: manilaDate(a.startAt), startTime: manilaTime(a.startAt),
  }));
  return ok(res, { user: { ...user.toJSON(), hasAccount: Boolean(user.passwordHash) }, profile, appointments: history });
});

exports.updatePatient = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'patient ID');
  const user = await User.findOne({ where: { id, role: 'patient' } });
  if (!user) throw new AppError(404, 'Patient not found', 'NOT_FOUND');

  const v = new Validator(req.body);
  v.string('name', { label: 'Full name', min: 2, max: 120 }).phone();
  // Email can only be set for walk-in patients who do not have an online account yet.
  if (req.body && req.body.email !== undefined && !user.email) v.email('email', { required: false });
  const data = v.done();

  if (data.email && (await User.findOne({ where: { email: data.email, id: { [Op.ne]: id } } }))) {
    throw new AppError(409, 'Another patient already uses this email', 'EMAIL_TAKEN', { email: 'This email is already registered' });
  }

  await sequelize.transaction(async (transaction) => {
    const changes = { name: data.name, phone: data.phone };
    if (data.email) changes.email = data.email;
    await user.update(changes, { transaction });
    await saveProfile(id, req.body.profile, transaction);
  });

  const profile = await PatientProfile.findOne({ where: { userId: id } });
  return ok(res, { user: user.toJSON(), profile }, 'Patient updated');
});

// ---- Staff accounts (admin) -------------------------------------------------------

exports.listStaff = asyncHandler(async (req, res) => {
  const staff = await User.findAll({ where: { role: { [Op.in]: ['staff', 'admin'] } }, order: [['role', 'ASC'], ['name', 'ASC']] });
  return ok(res, staff);
});

exports.createStaff = asyncHandler(async (req, res) => {
  const v = new Validator(req.body);
  v.string('name', { label: 'Full name', min: 2, max: 120 }).email().phone('phone', { required: false }).password();
  const data = v.done();

  if (await User.findOne({ where: { email: data.email } })) {
    throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN', { email: 'This email is already registered' });
  }
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await User.create({ name: data.name, email: data.email, phone: data.phone, passwordHash, role: 'staff' });
  return created(res, user, 'Staff account created');
});

exports.setUserStatus = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id, 'user ID');
  const v = new Validator(req.body);
  v.boolean('isActive', { required: true });
  const { isActive } = v.done();

  if (id === req.user.id) throw new AppError(409, 'You cannot deactivate your own account', 'SELF_DEACTIVATION');
  const user = await User.findByPk(id);
  if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

  await user.update({ isActive });
  return ok(res, user, isActive ? 'Account activated' : 'Account deactivated');
});
