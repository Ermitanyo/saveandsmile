// Creates (or resets) the database structure and loads starting data.
//
//   npm run db:setup   -> create tables if missing + clinic defaults (hours, services)
//   npm run db:demo    -> same, plus demo accounts and sample appointments
//   npm run db:reset   -> DROP EVERYTHING in the database, then db:setup + demo (development only!)
const bcrypt = require('bcryptjs');
const config = require('../config');
const {
  sequelize, User, PatientProfile, Service, ClinicSchedule, Appointment,
} = require('../models');
const { manilaDate, addDays, toInstant } = require('../utils/time');

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const DEMO = args.includes('--demo');

const DEFAULT_SERVICES = [
  { name: 'Dental Consultation', description: 'Check-up and consultation with the dentist.', durationMinutes: 30 },
  { name: 'Oral Prophylaxis (Cleaning)', description: 'Professional teeth cleaning and polishing.', durationMinutes: 60 },
  { name: 'Tooth Filling (Pasta)', description: 'Restoration of a cavity with filling material.', durationMinutes: 60 },
  { name: 'Tooth Extraction', description: 'Removal of a tooth.', durationMinutes: 60 },
  { name: 'Braces Adjustment', description: 'Regular adjustment visit for orthodontic braces.', durationMinutes: 30 },
  { name: 'Teeth Whitening', description: 'Cosmetic teeth whitening treatment.', durationMinutes: 90 },
];

async function addNoOverlapConstraint() {
  const [rows] = await sequelize.query("SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap'");
  if (rows.length > 0) return console.log('  - overlap protection already installed');
  try {
    // PostgreSQL itself refuses two active appointments whose time ranges overlap.
    await sequelize.query(`
      ALTER TABLE "Appointments"
      ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (tstzrange("startAt", "endAt", '[)') WITH &&)
      WHERE (status = 'pending' OR status = 'confirmed' OR status = 'rescheduled')
    `);
    console.log('  - overlap protection installed (database-level double-booking guard)');
  } catch (err) {
    console.warn('  ! Could not install the database overlap constraint:', err.message);
    console.warn('  ! The app still blocks double booking with a transaction + lock, but please tell your team.');
  }
}

async function seedDefaults() {
  if ((await ClinicSchedule.count()) === 0) {
    // Based on the clinic's printed form: "Open daily 9am to 8pm". Change in Admin > Clinic Hours.
    const days = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek, isOpen: true, openTime: '09:00', closeTime: '20:00', breakStart: null, breakEnd: null,
    }));
    await ClinicSchedule.bulkCreate(days);
    console.log('  - default opening hours added (daily 09:00-20:00)');
  }
  if ((await Service.count()) === 0) {
    await Service.bulkCreate(DEFAULT_SERVICES);
    console.log('  - sample services added (durations are placeholders to confirm with the clinic)');
  }
}

async function ensureUser({ name, email, password, role, phone }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role, phone });
  if (role === 'patient') await PatientProfile.create({ userId: user.id, privacyConsent: true, privacyConsentAt: new Date() });
  return user;
}

async function seedDemo() {
  await ensureUser({ name: 'Dr. Demo Admin', email: 'admin@saveandsmile.test', password: 'Admin12345', role: 'admin', phone: '09170000001' });
  await ensureUser({ name: 'Demo Staff', email: 'staff@saveandsmile.test', password: 'Staff12345', role: 'staff', phone: '09170000002' });
  const patient = await ensureUser({ name: 'Juan Dela Cruz', email: 'patient@saveandsmile.test', password: 'Patient12345', role: 'patient', phone: '09170000003' });

  // A walk-in patient registered by staff (no online account)
  let walkIn = await User.findOne({ where: { name: 'Maria Santos', role: 'patient' } });
  if (!walkIn) {
    walkIn = await User.create({ name: 'Maria Santos', phone: '09170000004', role: 'patient' });
    await PatientProfile.create({ userId: walkIn.id, address: 'Sample Street, Cebu City', occupation: 'Teacher' });
  }

  if ((await Appointment.count()) === 0) {
    const services = await Service.findAll({ order: [['id', 'ASC']] });
    const today = manilaDate(new Date());
    const make = (patientId, service, date, time, status) => {
      const startAt = toInstant(date, time);
      return {
        patientId, serviceId: service.id, startAt, endAt: new Date(startAt.getTime() + service.durationMinutes * 60000),
        status, notes: 'Sample appointment (demo data)',
      };
    };
    await Appointment.bulkCreate([
      make(patient.id, services[1], addDays(today, -7), '10:00', 'completed'),
      make(patient.id, services[0], addDays(today, 2), '10:00', 'confirmed'),
      make(patient.id, services[2], addDays(today, 3), '14:00', 'pending'),
      make(walkIn.id, services[0], addDays(today, 3), '15:00', 'pending'),
      make(walkIn.id, services[4], today, '18:00', 'confirmed'),
    ]);
    console.log('  - sample appointments added');
  }
  console.log('  - demo accounts ready (see README for logins). Do NOT keep them on a real server.');
}

async function main() {
  if (!config.db.name || !config.db.user || !config.db.password) {
    console.error('Set DB_NAME, DB_USER and DB_PASSWORD in the .env file first (copy .env.example).');
    process.exit(1);
  }
  if (RESET && config.nodeEnv === 'production') {
    console.error('Refusing to reset the database while NODE_ENV=production.');
    process.exit(1);
  }

  await sequelize.authenticate();
  console.log(`Connected to PostgreSQL database "${config.db.name}".`);

  if (RESET) {
    console.log('RESET: dropping all existing tables...');
    const qi = sequelize.getQueryInterface();
    await qi.dropAllTables();
    await qi.dropAllEnums();
  }

  await sequelize.sync(); // creates any missing tables; never touches existing data
  console.log('Tables are ready.');
  await addNoOverlapConstraint();
  await seedDefaults();
  if (DEMO) await seedDemo();

  console.log('Done.');
  await sequelize.close();
}

main().catch(async (err) => {
  console.error('Database setup failed:', err.message);
  try { await sequelize.close(); } catch (e) { /* ignore */ }
  process.exit(1);
});
