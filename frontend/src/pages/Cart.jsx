import { useMemo, useState } from 'react';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { formatCurrency } from '../utils/number.js';

const getUnitMeta = (item) => {
  const units = (item.units || []).slice().sort((a, b) => a.multiplier - b.multiplier);
  const fallbackUnit = units[0] || { level: 0, name: 'unit', multiplier: 1 };
  const unit =
    units.find((entry) => entry.level === Number(item.unitLevel)) ||
    units[item.unitLevel] ||
    fallbackUnit;
  const baseUnit = fallbackUnit;
  return {
    unit,
    baseUnit,
  };
};

const CartPage = () => {
  const cart = useInventoryStore((state) => state.cart);
  const removeFromCart = useInventoryStore((state) => state.removeFromCart);
  const updateCartQuantity = useInventoryStore((state) => state.updateCartQuantity);
  const updateCartUnitLevel = useInventoryStore((state) => state.updateCartUnitLevel);
  const checkout = useInventoryStore((state) => state.checkout);
  const settings = useInventoryStore((state) => state.settings);

  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const computeLine = (item) => {
    const { unit, baseUnit } = getUnitMeta(item);
    const quantity = Number(item.quantity) || 0;
    const baseMultiplier = unit?.multiplier || 1;
    const basePrice = Number(item.baseUnitPrice ?? item.price) || 0;
    const unitPrice =
      unit?.price != null ? Number(unit.price) : basePrice * baseMultiplier;
    const baseQuantity = quantity * baseMultiplier;
    const subtotal = unitPrice * quantity;
    return { baseQuantity, subtotal, unit, unitPrice, baseUnit };
  };

  const summary = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + computeLine(item).subtotal, 0);
    const taxRate = settings?.taxRate ?? 0;
    const tax = subtotal * taxRate;
    return {
      subtotal,
      tax,
      total: subtotal + tax,
      currency: settings?.currency || 'USD',
    };
  }, [cart, settings]);

  const handleCheckout = async () => {
    setStatus('loading');
    setError(null);
    try {
      await checkout();
    } catch (err) {
      setError(err.response?.data?.message || 'Checkout failed');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Cart & Checkout</h2>
        <p className="text-sm text-slate-500">Add items to the cart and confirm sales</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm divide-y">
          {cart.length ? (
            cart.map((item) => {
              const { baseQuantity, subtotal, unit, unitPrice, baseUnit } = computeLine(item);
              const unitLabel = unit?.name || 'unit';
              const baseLabel = baseUnit?.name || 'unit';
              let unitOptions = (item.units || []).slice().sort((a, b) => a.multiplier - b.multiplier);
              if (!unitOptions.length) {
                unitOptions = [
                  { level: 0, name: baseLabel, multiplier: 1, price: unitPrice },
                ];
              }

              return (
                <div
                  key={`${item.productId}-${item.unitLevel ?? 'base'}`}
                  className="p-4 flex items-center gap-4"
                >
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-lg border" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-sm text-slate-500">
                      {formatCurrency(unitPrice, summary.currency)} / {unitLabel}
                    </p>
                    <div className="flex gap-2 items-center mt-2 flex-wrap">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value);
                      const safeValue = Number.isFinite(nextValue) ? nextValue : 1;
                      updateCartQuantity(item.productId, Math.max(1, safeValue), item.unitLevel);
                    }}
                        className="w-24 border border-slate-200 rounded-lg px-2 py-1"
                      />
                      <select
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
                        value={item.unitLevel ?? 0}
                        onChange={(e) =>
                          updateCartUnitLevel(
                            item.productId,
                            Number(e.target.value),
                            item.unitLevel
                          )
                        }
                      >
                        {unitOptions.map((option) => {
                          const optionPrice =
                            option.price ??
                            (item.baseUnitPrice ?? item.price) * (option.multiplier || 1);
                          return (
                            <option key={option.level} value={option.level}>
                              {option.name} • {formatCurrency(optionPrice, summary.currency)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Selling {item.quantity} {unitLabel}
                      {unit?.multiplier > 1
                        ? ` (${baseQuantity.toLocaleString()} ${baseLabel})`
                        : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">
                      {formatCurrency(subtotal, summary.currency)}
                    </p>
                    <button
                      type="button"
                      className="text-sm text-red-500"
                      onClick={() => removeFromCart(item.productId, item.unitLevel)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="p-6 text-sm text-slate-500">Cart is empty. Add products from the catalog.</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-slate-900 mb-4">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(summary.subtotal, summary.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">
                Tax ({((settings?.taxRate ?? 0) * 100).toFixed(2)}%)
              </span>
              <span className="font-medium">{formatCurrency(summary.tax, summary.currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-slate-900 pt-2 border-t">
              <span>Total</span>
              <span>{formatCurrency(summary.total, summary.currency)}</span>
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          <button
            className="mt-4 w-full bg-emerald-600 text-white py-2 rounded-lg font-medium disabled:opacity-50"
            disabled={!cart.length || status === 'loading'}
            onClick={handleCheckout}
          >
            {status === 'loading' ? 'Processing…' : 'Complete Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
