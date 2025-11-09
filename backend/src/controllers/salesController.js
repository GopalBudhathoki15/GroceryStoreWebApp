const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Setting = require('../models/Setting');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const { buildSalesCsv } = require('../utils/exporters');

const getActiveSettings = async () => {
  const existing = await Setting.findOne();
  if (existing) return existing;
  const created = await Setting.create({});
  return created;
};

const normalizeSaleQuantity = (itemQuantity) => {
  const parsed = Number(itemQuantity);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  return parsed;
};

const getUnitByLevel = (units = [], level = 0) => {
  const numericLevel = Number(level);
  const sorted = units.slice().sort((a, b) => a.multiplier - b.multiplier);
  return (
    sorted.find((unit) => unit.level === numericLevel) ||
    sorted[numericLevel] ||
    sorted[0] || { level: 0, name: 'unit', multiplier: 1 }
  );
};

const checkout = async (req, res) => {
  try {
    const {
      items,
      customerId,
      customerName,
      amountReceived,
      paymentMethod = 'cash',
      notes,
      discountAmount = 0,
      discountNote,
      dueNote,
    } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart items are required' });
    }

    const productIds = items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const saleItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productId} not found` });
      }
      const unit = getUnitByLevel(product.units, item.unitLevel);
      if (!unit) {
        return res.status(400).json({ message: `${product.name} has no matching unit` });
      }
      const quantity = normalizeSaleQuantity(item.quantity);
      const baseQuantity = quantity * unit.multiplier;

      const unitPrice =
        unit.price != null
          ? Number(unit.price)
          : product.price * unit.multiplier;
      const pricePerBaseUnit = unit.multiplier ? unitPrice / unit.multiplier : product.price;

      if (product.quantity < baseQuantity) {
        return res.status(400).json({ message: `${product.name} has insufficient stock` });
      }

      const itemSubtotal = unitPrice * quantity;
      saleItems.push({
        productId: product._id,
        name: product.name,
        quantity: baseQuantity,
        unitQuantity: quantity,
        unitLevel: unit.level,
        unitLabel: unit.name,
        unitMultiplier: unit.multiplier,
        baseUnitLabel: product.units?.find((u) => u.level === 0)?.name || 'unit',
        price: pricePerBaseUnit,
        unitPrice,
        subtotal: itemSubtotal,
      });
      subtotal += itemSubtotal;
    }

    const settings = await getActiveSettings();
    const parsedDiscount = Math.max(0, Number(discountAmount) || 0);
    const cappedDiscount = Math.min(parsedDiscount, subtotal);
    const discountedSubtotal = subtotal - cappedDiscount;
    const tax = discountedSubtotal * settings.taxRate;
    const total = discountedSubtotal + tax;

    let customer = null;
    if (customerId) {
      customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ message: 'Customer not found' });
      }
    }

    const received =
      amountReceived === undefined || amountReceived === null
        ? total
        : Math.max(0, Number(amountReceived));
    if (!Number.isFinite(received)) {
      return res.status(400).json({ message: 'Invalid amount received' });
    }

    const paidAmount = Math.min(received, total);
    const dueAmount = Math.max(0, Number((total - paidAmount).toFixed(2)));

    if (dueAmount > 0 && !customer) {
      return res.status(400).json({ message: 'Customer is required for partial payments' });
    }

    const saleStatus = dueAmount > 0 ? (paidAmount > 0 ? 'partial' : 'unpaid') : 'paid';

    const sale = await Sale.create({
      items: saleItems,
      subtotal,
      discountAmount: cappedDiscount,
      discountNote,
      tax,
      total,
      currency: settings.currency,
      customerId: customer ? customer._id : undefined,
      customerName: customer ? customer.name : customerName,
      paymentMethod,
      paidAmount,
      dueAmount,
      status: saleStatus,
      notes,
      dueNote: dueNote || undefined,
    });

    await Promise.all(
      saleItems.map((item) =>
        Product.findByIdAndUpdate(item.productId, { $inc: { quantity: -item.quantity } })
      )
    );

    if (customer) {
      if (dueAmount > 0) {
        customer.balance = Math.max(0, customer.balance + dueAmount);
      }
      await customer.save();
      if (paidAmount > 0) {
        await Payment.create({
          customerId: customer._id,
          saleId: sale._id,
          amount: paidAmount,
          method: paymentMethod,
          type: 'payment',
        });
      }
      if (dueAmount > 0) {
        await Payment.create({
          customerId: customer._id,
          saleId: sale._id,
          amount: dueAmount,
          method: paymentMethod,
          type: 'charge',
        });
      }
    }

    return res.status(201).json(await Sale.findById(sale._id));
  } catch (error) {
    if (error.message?.includes('Quantity must be greater than zero')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Checkout failed' });
  }
};

const getSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    return res.json(sales);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load sales' });
  }
};

const exportSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    const { format } = req.query;

    if (format === 'csv') {
      const csv = buildSalesCsv(sales);
      res.header('Content-Type', 'text/csv');
      res.attachment('sales.csv');
      return res.send(csv);
    }

    res.header('Content-Type', 'application/json');
    return res.send(JSON.stringify(sales, null, 2));
  } catch (error) {
    return res.status(500).json({ message: 'Failed to export sales' });
  }
};

module.exports = {
  checkout,
  getSales,
  exportSales,
};
