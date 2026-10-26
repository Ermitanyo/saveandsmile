const router = require('express').Router();
const availability = require('../controllers/availabilityController');
const { optionalAuthenticate } = require('../middleware/auth');

router.get('/dates', optionalAuthenticate, availability.dates);
router.get('/slots', optionalAuthenticate, availability.slots);

module.exports = router;
