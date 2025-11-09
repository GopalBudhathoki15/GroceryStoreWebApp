const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: 'My Local Grocery' },
    currency: { type: String, default: 'USD' },
    taxRate: { type: Number, default: 0.07 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', SettingSchema);
