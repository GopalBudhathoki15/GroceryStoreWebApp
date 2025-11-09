const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Payment = require('../models/Payment');

const listCustomers = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
    }
    const customers = await Customer.find(filter).sort({ name: 1 });
    return res.json(customers);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load customers' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const customer = await Customer.create({ name, phone, email, address, notes });
    return res.status(201).json(customer);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create customer' });
  }
};

const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    const openSales = await Sale.find({
      customerId: customer._id,
      dueAmount: { $gt: 0 },
    })
      .sort({ createdAt: -1 })
      .lean();
    const recentSales = await Sale.find({ customerId: customer._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return res.json({ customer, openSales, recentSales });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load customer' });
  }
};

const recordPayment = async (req, res) => {
  try {
    const { amount, method = 'cash', saleId, note } = req.body;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    let remaining = parsedAmount;
    const salesToUpdate = [];

    if (saleId) {
      const sale = await Sale.findOne({ _id: saleId, customerId: customer._id });
      if (!sale) {
        return res.status(404).json({ message: 'Sale not found for this customer' });
      }
      if (sale.dueAmount <= 0) {
        return res.status(400).json({ message: 'Sale has no outstanding balance' });
      }
      salesToUpdate.push(sale);
    } else {
      const openSales = await Sale.find({
        customerId: customer._id,
        dueAmount: { $gt: 0 },
      }).sort({ createdAt: 1 });
      salesToUpdate.push(...openSales);
    }

    let applied = 0;
    for (const sale of salesToUpdate) {
      if (remaining <= 0) break;
      const apply = Math.min(sale.dueAmount, remaining);
      sale.dueAmount -= apply;
      sale.paidAmount += apply;
      sale.status = sale.dueAmount > 0 ? 'partial' : 'paid';
      await sale.save();
      remaining -= apply;
      applied += apply;
    }

    if (applied === 0) {
      return res.status(400).json({ message: 'No outstanding balance to apply payment' });
    }

    customer.balance = Math.max(0, customer.balance - applied);
    await customer.save();

    await Payment.create({
      customerId: customer._id,
      saleId: saleId || undefined,
      amount: applied,
      method,
      type: 'payment',
      note,
    });

    const updatedSales = await Sale.find({ customerId: customer._id }).sort({ createdAt: -1 });

    return res.json({
      customer,
      applied,
      remaining,
      sales: updatedSales,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to record payment' });
  }
};

module.exports = {
  listCustomers,
  createCustomer,
  getCustomer,
  recordPayment,
  updateCustomer: async (req, res) => {
    try {
      const updates = (({ name, phone, email, address, notes }) => ({
        name,
        phone,
        email,
        address,
        notes,
      }))(req.body);
      Object.keys(updates).forEach(
        (key) => (updates[key] === undefined ? delete updates[key] : null)
      );
      const customer = await Customer.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      return res.json(customer);
    } catch (error) {
      return res.status(500).json({ message: 'Failed to update customer' });
    }
  },
  deleteCustomer: async (req, res) => {
    try {
      const customer = await Customer.findById(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
      if (customer.balance > 0) {
        return res.status(400).json({ message: 'Clear outstanding balance before deleting' });
      }
      await Customer.findByIdAndDelete(req.params.id);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to delete customer' });
    }
  },
};
