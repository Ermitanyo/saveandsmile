const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(120), allowNull: false, validate: { notEmpty: true } },
    // Optional so staff can register walk-in patients who have no online account.
    email: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    passwordHash: { type: DataTypes.STRING(100), allowNull: true },
    phone: { type: DataTypes.STRING(30), allowNull: true },
    role: { type: DataTypes.ENUM('patient', 'staff', 'admin'), allowNull: false, defaultValue: 'patient' },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: 'Users',
    // The password hash is never selected unless we ask for the "withPassword" scope (login only).
    defaultScope: { attributes: { exclude: ['passwordHash'] } },
    scopes: { withPassword: { attributes: { exclude: [] } } },
  }
);

// Safety net: never serialize the hash, even by accident.
User.prototype.toJSON = function toJSON() {
  const values = { ...this.get({ plain: true }) };
  delete values.passwordHash;
  return values;
};

module.exports = User;
