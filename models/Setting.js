const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Simple key/value table for booking rules (slot interval, cancellation cutoff, ...).
const Setting = sequelize.define(
  'Setting',
  {
    key: { type: DataTypes.STRING(60), primaryKey: true },
    value: { type: DataTypes.STRING(255), allowNull: false },
  },
  { tableName: 'Settings', timestamps: false }
);

module.exports = Setting;
