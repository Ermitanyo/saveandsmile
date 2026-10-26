const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const STATUSES = ['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show'];

const Appointment = sequelize.define(
  'Appointment',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    patientId: { type: DataTypes.INTEGER, allowNull: false },
    serviceId: { type: DataTypes.INTEGER, allowNull: false },
    // timestamptz columns: stored in UTC, shown in Asia/Manila by the app
    startAt: { type: DataTypes.DATE, allowNull: false },
    endAt: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.ENUM(...STATUSES), allowNull: false, defaultValue: 'pending' },
    notes: { type: DataTypes.STRING(500), allowNull: true },        // patient's reason / concern
    staffNotes: { type: DataTypes.STRING(1000), allowNull: true },  // clinic-only notes
    cancelReason: { type: DataTypes.STRING(255), allowNull: true },
    cancelledBy: { type: DataTypes.ENUM('patient', 'staff', 'admin'), allowNull: true },
    createdById: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: 'Appointments',
    indexes: [{ fields: ['startAt'] }, { fields: ['patientId'] }, { fields: ['status'] }],
    validate: {
      endAfterStart() {
        if (this.endAt <= this.startAt) throw new Error('endAt must be after startAt');
      },
    },
  }
);

Appointment.STATUSES = STATUSES;
module.exports = Appointment;
