import { useEffect } from 'react';
import { format } from 'date-fns';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { client } from '../api/client.js';
import { formatCurrency } from '../utils/number.js';

const ReportsPage = () => {
  const sales = useInventoryStore((state) => state.sales);
  const fetchSales = useInventoryStore((state) => state.fetchSales);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const handleExport = async (formatType) => {
    const response = await client.get(`/sales/export?format=${formatType}`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: formatType === 'csv' ? 'text/csv' : 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales.${formatType}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Sales Reports</h2>
          <p className="text-sm text-slate-500">Detailed sales history and exports</p>
        </div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
            onClick={() => handleExport('json')}
          >
            Export JSON
          </button>
          <button
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm"
            onClick={() => handleExport('csv')}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-500">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Items</th>
              <th className="py-3 px-4">Units (base)</th>
              <th className="py-3 px-4">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale._id} className="border-b last:border-b-0">
                <td className="py-3 px-4 text-slate-700">{format(new Date(sale.createdAt), 'PPpp')}</td>
                <td className="py-3 px-4 text-slate-600">
                  <ul className="space-y-1">
                    {sale.items.map((item) => {
                      const unitLabel = item.unitLabel || item.baseUnitLabel || 'units';
                      const baseLabel = item.baseUnitLabel || 'units';
                      const unitQuantity = Number(
                        item.unitQuantity ?? item.quantity / (item.unitMultiplier || 1)
                      );
                      const baseQuantity = Number(item.quantity).toLocaleString();
                      const hasHigherUnit = (item.unitMultiplier || 1) > 1;
                      const unitPriceValue =
                        item.unitPrice ??
                        (item.price * (item.unitMultiplier || 1));
                      const unitPriceLabel = formatCurrency(unitPriceValue, sale.currency);
                      const lineTotal = formatCurrency(
                        item.subtotal ?? unitPriceValue * unitQuantity,
                        sale.currency
                      );
                      return (
                        <li key={item.productId}>
                          {item.name} (
                          {hasHigherUnit
                            ? `${unitQuantity.toLocaleString()} ${unitLabel} · ${baseQuantity} ${baseLabel}`
                            : `${baseQuantity} ${baseLabel}`}
                          ) @ {unitPriceLabel} – {lineTotal}
                        </li>
                      );
                    })}
                  </ul>
                </td>
                <td className="py-3 px-4 text-slate-600">
                  {sale.items
                    .map(
                      (item) =>
                        `${Number(item.quantity).toLocaleString()} ${item.baseUnitLabel || 'units'}`
                    )
                    .join(', ')}
                </td>
                <td className="py-3 px-4 font-semibold text-slate-900">
                  {formatCurrency(sale.total, sale.currency)}
                </td>
              </tr>
            ))}
            {!sales.length && (
              <tr>
                <td colSpan="4" className="py-6 text-center text-slate-500">
                  No sales recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportsPage;
