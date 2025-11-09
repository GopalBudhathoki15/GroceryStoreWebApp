const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, default: 'cash' },
    type: {
      type: String,
      enum: ['charge', 'payment'],
      required: true,
    },
    note: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', PaymentSchema);
