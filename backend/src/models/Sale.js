const mongoose = require('mongoose');

const SaleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    quantity: Number,
    unitQuantity: Number,
    unitLevel: { type: Number, min: 0, max: 2, default: 0 },
    unitLabel: String,
    unitMultiplier: Number,
    baseUnitLabel: String,
    price: Number,
    unitPrice: Number,
    subtotal: Number,
  },
  { _id: false }
);

const SaleSchema = new mongoose.Schema(
  {
    items: [SaleItemSchema],
    subtotal: Number,
    tax: Number,
    total: Number,
    currency: { type: String, default: 'USD' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String },
    paymentMethod: { type: String, default: 'cash' },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['paid', 'partial', 'unpaid'],
      default: 'paid',
    },
    notes: { type: String },
    discountAmount: { type: Number, default: 0 },
    discountNote: { type: String },
    dueNote: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sale', SaleSchema);
