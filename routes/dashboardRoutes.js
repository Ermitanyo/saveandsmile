const router = require('express').Router();
const dashboard = require('../controllers/dashboardController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.get('/patient', requireRole('patient'), dashboard.patient);
router.get('/staff', requireRole('staff', 'admin'), dashboard.staff);

module.exports = router;
