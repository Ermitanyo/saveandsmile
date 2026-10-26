const config = require('./config');
const app = require('./app');
const { sequelize } = require('./models');

async function start() {
  const missing = [];
  if (!config.db.name) missing.push('DB_NAME');
  if (!config.db.user) missing.push('DB_USER');
  if (!config.db.password) missing.push('DB_PASSWORD');
  if (!config.jwt.secret || config.jwt.secret.length < 32) missing.push('JWT_SECRET (at least 32 characters)');
  if (missing.length) {
    console.error(`Missing or invalid settings in .env: ${missing.join(', ')}`);
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    console.log('Connected to PostgreSQL.');

    // The tables are created by "npm run db:setup". Fail early with a clear hint if that was skipped.
    const tables = await sequelize.getQueryInterface().showAllTables();
    if (!tables.includes('Appointments') || !tables.includes('Users')) {
      console.error('Database tables not found. Run "npm run db:setup" in the server folder first.');
      process.exit(1);
    }

    app.listen(config.port, () => console.log(`API running at http://localhost:${config.port}/api`));
  } catch (err) {
    console.error('Unable to start the server:', err.message);
    process.exit(1);
  }
}

start();
