const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// One row per weekday (0 = Sunday ... 6 = Saturday): opening hours and optional lunch break.
const ClinicSchedule = sequelize.define(
  'ClinicSchedule',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    dayOfWeek: { type: DataTypes.INTEGER, allowNull: false, unique: true, validate: { min: 0, max: 6 } },
    isOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    openTime: { type: DataTypes.TIME, allowNull: false },
    closeTime: { type: DataTypes.TIME, allowNull: false },
    breakStart: { type: DataTypes.TIME, allowNull: true },
    breakEnd: { type: DataTypes.TIME, allowNull: true },
  },
  { tableName: 'ClinicSchedules' }
);

module.exports = ClinicSchedule;
