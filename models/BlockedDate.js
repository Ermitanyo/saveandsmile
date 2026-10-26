const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Holidays and other days the clinic is closed.
const BlockedDate = sequelize.define(
  'BlockedDate',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
    reason: { type: DataTypes.STRING(255), allowNull: true },
  },
  { tableName: 'BlockedDates' }
);

module.exports = BlockedDate;
