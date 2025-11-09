const express = require('express');
const { getInventorySummary } = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', requireRoles(['admin']), getInventorySummary);

module.exports = router;
