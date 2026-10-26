const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Digital version of the clinic's paper "Patient Information" form.
const PatientProfile = sequelize.define(
  'PatientProfile',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    birthDate: { type: DataTypes.DATEONLY, allowNull: true },
    civilStatus: { type: DataTypes.STRING(30), allowNull: true },
    occupation: { type: DataTypes.STRING(120), allowNull: true },
    address: { type: DataTypes.STRING(255), allowNull: true },
    telephone: { type: DataTypes.STRING(30), allowNull: true },
    officeAddress: { type: DataTypes.STRING(255), allowNull: true },
    officeTelephone: { type: DataTypes.STRING(30), allowNull: true },
    responsiblePerson: { type: DataTypes.STRING(120), allowNull: true },
    emergencyContactName: { type: DataTypes.STRING(120), allowNull: true },
    emergencyContactPhone: { type: DataTypes.STRING(30), allowNull: true },
    // Medical history checkboxes from the paper form (keys, see utils/profileFields.js)
    medicalHistory: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    medicalOther: { type: DataTypes.STRING(255), allowNull: true },
    medications: { type: DataTypes.STRING(255), allowNull: true },
    allergyFood: { type: DataTypes.STRING(255), allowNull: true },
    allergyDrug: { type: DataTypes.STRING(255), allowNull: true },
    hospitalizationNotes: { type: DataTypes.STRING(255), allowNull: true },
    physicianName: { type: DataTypes.STRING(120), allowNull: true },
    physicianContact: { type: DataTypes.STRING(120), allowNull: true },
    // Dental history checkboxes from the paper form
    dentalHistory: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    gingivitisSeverity: { type: DataTypes.ENUM('mild', 'moderate', 'severe'), allowNull: true },
    lastDentalVisit: { type: DataTypes.STRING(120), allowNull: true },
    // Consent to store this information (Data Privacy Act). Treatment consent is still signed at the clinic.
    privacyConsent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    privacyConsentAt: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'PatientProfiles' }
);

module.exports = PatientProfile;
