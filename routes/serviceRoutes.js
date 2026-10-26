const router = require('express').Router();
const services = require('../controllers/serviceController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', services.listActive); // public
router.get('/all', authenticate, requireRole('staff', 'admin'), services.listAll);
router.post('/', authenticate, requireRole('admin'), services.create);
router.put('/:id', authenticate, requireRole('admin'), services.update);
router.patch('/:id/status', authenticate, requireRole('admin'), services.setStatus);

module.exports = router;
