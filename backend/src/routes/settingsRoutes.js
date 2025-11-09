const express = require('express');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', requireRoles(['admin', 'staff']), getSettings);
router.put('/', requireRoles(['admin']), updateSettings);

module.exports = router;
