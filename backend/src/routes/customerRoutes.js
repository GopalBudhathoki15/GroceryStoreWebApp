const express = require('express');
const {
  listCustomers,
  createCustomer,
  getCustomer,
  recordPayment,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', requireRoles(['admin', 'staff']), listCustomers);
router.post('/', requireRoles(['admin', 'staff']), createCustomer);
router.get('/:id', requireRoles(['admin', 'staff']), getCustomer);
router.post('/:id/payments', requireRoles(['admin', 'staff']), recordPayment);
router.put('/:id', requireRoles(['admin']), updateCustomer);
router.delete('/:id', requireRoles(['admin']), deleteCustomer);

module.exports = router;
