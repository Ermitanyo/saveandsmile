const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Service = sequelize.define(
  'Service',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    durationMinutes: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 15, max: 480 } },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: 'Services' }
);

module.exports = Service;
