import { useEffect } from 'react';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { formatCurrency } from '../utils/number.js';
import { format } from 'date-fns';

const DashboardPage = () => {
  const dashboard = useInventoryStore((state) => state.dashboard);
  const sales = useInventoryStore((state) => state.sales);
  const fetchDashboard = useInventoryStore((state) => state.fetchDashboard);
  const fetchProducts = useInventoryStore((state) => state.fetchProducts);
  const fetchSales = useInventoryStore((state) => state.fetchSales);
  const settings = useInventoryStore((state) => state.settings);

  useEffect(() => {
    fetchDashboard();
    fetchProducts();
    fetchSales();
  }, [fetchDashboard, fetchProducts, fetchSales]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Inventory Dashboard</h2>
        <p className="text-sm text-slate-500">Overview of stock levels and sales</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <SummaryCard
          label="Products"
          value={dashboard?.totalProducts ?? '--'}
        />
        <SummaryCard
          label="Inventory Value"
          value={formatCurrency(dashboard?.totalInventoryValue || 0, settings?.currency)}
        />
        <SummaryCard
          label="Total Sales"
          value={formatCurrency(dashboard?.totalSales || 0, settings?.currency)}
        />
        <SummaryCard
          label="Sales Count"
          value={dashboard?.saleCount ?? 0}
        />
        <SummaryCard
          label="Receivables"
          value={formatCurrency(dashboard?.totalReceivables || 0, settings?.currency)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Low Stock Alerts</h3>
            <span className="text-sm text-slate-500">{dashboard?.lowStock?.length || 0} items</span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {dashboard?.lowStock?.length ? (
              dashboard.lowStock.map((product) => {
                const breakdownEntries = product.stockBreakdown || [];
                const breakdown = breakdownEntries
                  .filter((entry, index) => entry.quantity > 0 || index === breakdownEntries.length - 1)
                  .map((entry) => `${entry.quantity} ${entry.name}`)
                  .join(', ');
                return (
                  <div
                    key={product._id}
                    className="flex items-center justify-between border border-slate-100 rounded-lg p-3"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.category}</p>
                    </div>
                    <span className="text-sm font-semibold text-amber-600 text-right">
                      {breakdown}
                    </span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No low stock products 🎉</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Top Selling Items</h3>
          </div>
          <div className="space-y-3">
            {dashboard?.topSelling?.length ? (
              dashboard.topSelling.map((item) => (
                <div key={item._id} className="flex items-center justify-between border border-slate-100 rounded-lg p-3">
                  <div>
                    <p className="font-medium text-slate-800">{item.name}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    {item.quantitySold} {item.baseUnitLabel || 'units'}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No sales recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Recent Sales</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Items</th>
                <th className="py-2 pr-4">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 5).map((sale) => (
                <tr key={sale._id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 text-slate-700">{format(new Date(sale.createdAt), 'PPpp')}</td>
                  <td className="py-2 pr-4 text-slate-600">{sale.items.map((item) => item.name).join(', ')}</td>
                  <td className="py-2 pr-4 font-semibold text-slate-900">{formatCurrency(sale.total, sale.currency)}</td>
                </tr>
              ))}
              {!sales.length && (
                <tr>
                  <td colSpan="3" className="py-4 text-center text-slate-500">
                    No sales data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value }) => (
  <div className="bg-white rounded-xl shadow-sm p-4">
    <p className="text-sm text-slate-500">{label}</p>
    <p className="text-2xl font-semibold text-slate-900 mt-2">{value}</p>
  </div>
);

export default DashboardPage;
