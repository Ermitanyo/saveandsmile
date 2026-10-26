const router = require('express').Router();
const notifications = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', notifications.list);
router.patch('/read-all', notifications.markAllRead);
router.patch('/:id/read', notifications.markRead);

module.exports = router;
