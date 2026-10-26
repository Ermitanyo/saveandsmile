const router = require('express').Router();
const appointments = require('../controllers/appointmentController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.post('/', appointments.create);
router.get('/', appointments.list);
router.get('/:id', appointments.getOne);
router.patch('/:id/status', appointments.changeStatus);
router.patch('/:id/reschedule', requireRole('staff', 'admin'), appointments.reschedule);
router.patch('/:id/notes', requireRole('staff', 'admin'), appointments.updateNotes);

module.exports = router;
