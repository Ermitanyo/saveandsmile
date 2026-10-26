const { Sequelize } = require('sequelize');
const config = require('./index');

// Timestamps are stored as timestamptz (UTC) in PostgreSQL.
const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'postgres',
  logging: false,
});

module.exports = sequelize;
