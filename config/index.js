const path = require('path');

// The single .env file lives in the project root (one level above /server).
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    cookieName: 'ss_token',
    cookieMaxAgeMs: 8 * 60 * 60 * 1000,
  },
  // Clinic is in the Philippines: UTC+8 all year (no daylight saving time).
  clinic: {
    timeZone: 'Asia/Manila',
    utcOffset: '+08:00',
  },
  rateLimit: {
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30, // per 15 minutes per IP
  },
};
