const { Parser } = require('json2csv');

const buildSalesCsv = (sales) => {
  const data = sales
    .map((sale) =>
      sale.items.map((item) => ({
        saleId: sale._id,
        date: sale.createdAt,
        product: item.name,
        unitQuantity: item.unitQuantity,
        unitLabel: item.unitLabel,
        baseQuantity: item.quantity,
        baseUnitLabel: item.baseUnitLabel,
        unitLevel: item.unitLevel,
        unitMultiplier: item.unitMultiplier,
        pricePerBaseUnit: item.price,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        tax: sale.tax,
        total: sale.total,
        currency: sale.currency,
      }))
    )
    .flat();

  const fields = [
    'saleId',
    'date',
    'product',
    'unitQuantity',
    'unitLabel',
    'baseQuantity',
    'baseUnitLabel',
    'unitLevel',
    'unitMultiplier',
    'pricePerBaseUnit',
    'unitPrice',
    'subtotal',
    'tax',
    'total',
    'currency',
  ];
  const parser = new Parser({ fields });
  return parser.parse(data);
};

module.exports = { buildSalesCsv };
