const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');

const getInventorySummary = async (_req, res) => {
  try {
    const [products, salesAgg, topSelling, receivablesAgg] = await Promise.all([
      Product.find(),
      Sale.aggregate([
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$total' },
            saleCount: { $sum: 1 },
          },
        },
      ]),
      Sale.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.name' },
            baseUnitLabel: { $first: '$items.baseUnitLabel' },
            quantitySold: { $sum: '$items.quantity' },
          },
        },
        { $sort: { quantitySold: -1 } },
        { $limit: 5 },
      ]),
      Customer.aggregate([
        {
          $group: {
            _id: null,
            totalReceivables: { $sum: '$balance' },
          },
        },
      ]),
    ]);

    const totalInventoryValue = products.reduce(
      (acc, product) => acc + product.price * product.quantity,
      0
    );

    const lowStock = products.filter((product) => product.quantity < 5);

    const salesSummary = salesAgg[0] || { totalSales: 0, saleCount: 0 };

    const receivablesSummary = receivablesAgg[0]?.totalReceivables || 0;

    return res.json({
      totalProducts: products.length,
      totalInventoryValue,
      lowStock,
      totalSales: salesSummary.totalSales,
      saleCount: salesSummary.saleCount,
      topSelling,
      totalReceivables: receivablesSummary,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load metrics' });
  }
};

module.exports = { getInventorySummary };
