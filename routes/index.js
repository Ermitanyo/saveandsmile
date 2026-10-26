const router = require('express').Router();

router.get('/health', (req, res) => res.json({ success: true, message: 'SaveandSmile API is running' }));
router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/services', require('./serviceRoutes'));
router.use('/availability', require('./availabilityRoutes'));
router.use('/schedules', require('./scheduleRoutes'));
router.use('/appointments', require('./appointmentRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/notifications', require('./notificationRoutes'));

module.exports = router;
