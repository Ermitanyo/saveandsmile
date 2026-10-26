const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define(
  'Notification',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    appointmentId: { type: DataTypes.INTEGER, allowNull: true },
    message: { type: DataTypes.STRING(500), allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { tableName: 'Notifications', updatedAt: false, indexes: [{ fields: ['userId', 'isRead'] }] }
);

module.exports = Notification;
