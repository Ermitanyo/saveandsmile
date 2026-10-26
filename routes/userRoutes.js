const router = require('express').Router();
const users = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// Own profile (every role)
router.get('/me', users.getMe);
router.put('/me', users.updateMe);

// Patient management (staff + admin)
router.get('/patients', requireRole('staff', 'admin'), users.listPatients);
router.post('/patients', requireRole('staff', 'admin'), users.createPatient);
router.get('/patients/:id', requireRole('staff', 'admin'), users.getPatient);
router.put('/patients/:id', requireRole('staff', 'admin'), users.updatePatient);

// Staff accounts (admin only)
router.get('/staff', requireRole('admin'), users.listStaff);
router.post('/staff', requireRole('admin'), users.createStaff);
router.patch('/:id/status', requireRole('admin'), users.setUserStatus);

module.exports = router;
