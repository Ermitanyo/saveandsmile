const router = require('express').Router();
const schedule = require('../controllers/scheduleController');
const { authenticate, requireRole } = require('../middleware/auth');

// Opening hours and booking rules are shown on the public website, so reading them is public.
router.get('/', schedule.getSchedules);
router.put('/', authenticate, requireRole('admin'), schedule.updateSchedules);

router.get('/settings', schedule.getSettings);
router.put('/settings', authenticate, requireRole('admin'), schedule.updateSettings);

router.get('/blocked-dates', authenticate, requireRole('staff', 'admin'), schedule.listBlockedDates);
router.post('/blocked-dates', authenticate, requireRole('admin'), schedule.createBlockedDate);
router.delete('/blocked-dates/:id', authenticate, requireRole('admin'), schedule.deleteBlockedDate);

module.exports = router;
