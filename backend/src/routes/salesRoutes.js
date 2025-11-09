const express = require('express');
const { checkout, getSales, exportSales } = require('../controllers/salesController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/checkout', requireRoles(['admin', 'staff']), checkout);
router.get('/', requireRoles(['admin']), getSales);
router.get('/export', requireRoles(['admin']), exportSales);

module.exports = router;
