// Loads every model and defines how they relate to each other.
const sequelize = require('../config/database');
const User = require('./User');
const PatientProfile = require('./PatientProfile');
const Service = require('./Service');
const ClinicSchedule = require('./ClinicSchedule');
const BlockedDate = require('./BlockedDate');
const Setting = require('./Setting');
const Appointment = require('./Appointment');
const Notification = require('./Notification');

User.hasOne(PatientProfile, { foreignKey: 'userId', as: 'profile', onDelete: 'CASCADE' });
PatientProfile.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Appointment, { foreignKey: 'patientId', as: 'appointments' });
Appointment.belongsTo(User, { foreignKey: 'patientId', as: 'patient' });
Appointment.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

Service.hasMany(Appointment, { foreignKey: 'serviceId', as: 'appointments' });
Appointment.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Appointment.hasMany(Notification, { foreignKey: 'appointmentId', as: 'notifications', onDelete: 'SET NULL' });
Notification.belongsTo(Appointment, { foreignKey: 'appointmentId', as: 'appointment' });

module.exports = {
  sequelize, User, PatientProfile, Service, ClinicSchedule, BlockedDate, Setting, Appointment, Notification,
};
