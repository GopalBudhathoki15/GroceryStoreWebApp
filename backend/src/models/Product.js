const mongoose = require('mongoose');

const UnitSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true, min: 0, max: 2 },
    name: { type: String, required: true, trim: true },
    multiplier: { type: Number, required: true, min: 1 },
    price: { type: Number, min: 0 },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    imageUrl: { type: String },
    units: {
      type: [UnitSchema],
      default: [{ level: 0, name: 'unit', multiplier: 1, price: 0 }],
      validate: [
        {
          validator(value) {
            if (!Array.isArray(value) || value.length === 0 || value.length > 3) {
              return false;
            }
            const sorted = [...value].sort((a, b) => a.level - b.level);
            if (sorted[0]?.multiplier !== 1) {
              return false;
            }
            for (let i = 0; i < sorted.length; i += 1) {
              const unit = sorted[i];
              if (unit.level !== i) return false;
              if (i > 0 && unit.multiplier <= sorted[i - 1].multiplier) {
                return false;
              }
              if (unit.price != null && (Number.isNaN(unit.price) || unit.price < 0)) {
                return false;
              }
            }
            if (sorted[0]?.price == null) return false;
            return true;
          },
          message:
            'Units must include a base level with multiplier 1 and price, plus up to two larger units with increasing multipliers',
        },
      ],
    },
  },
  { timestamps: true }
);

const getUnitsSortedAsc = (product) =>
  (product.units || []).slice().sort((a, b) => a.multiplier - b.multiplier);

ProductSchema.virtual('baseUnitName').get(function baseUnitName() {
  return getUnitsSortedAsc(this)[0]?.name || 'unit';
});

ProductSchema.virtual('stockBreakdown').get(function stockBreakdown() {
  const unitsDesc = getUnitsSortedAsc(this).sort((a, b) => b.multiplier - a.multiplier);
  if (!unitsDesc.length) {
    return [{ name: 'unit', quantity: this.quantity }];
  }

  let remaining = this.quantity;
  const breakdown = [];

  unitsDesc.forEach((unit, index) => {
    const isSmallest = index === unitsDesc.length - 1;
    const count = isSmallest ? remaining : Math.floor(remaining / unit.multiplier);
    remaining -= count * unit.multiplier;
    if (count > 0 || isSmallest) {
      breakdown.push({ name: unit.name, quantity: count });
    }
  });

  return breakdown;
});

ProductSchema.virtual('currentStockInBaseUom').get(function getBaseStock() {
  return this.quantity;
});

ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', ProductSchema);
