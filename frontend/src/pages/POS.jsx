import { useEffect, useMemo, useState } from 'react';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { formatCurrency } from '../utils/number.js';

const deriveUnitPrice = (unit, basePrice) => {
  const numericBase = Number(basePrice) || 0;
  const multiplier = unit?.multiplier || 1;
  return unit?.price != null ? Number(unit.price) : numericBase * multiplier;
};

const getUnits = (product) => {
  const basePrice = Number(product.price) || 0;
  const units = product.units?.length
    ? product.units.slice()
    : [
        {
          level: 0,
          name: product.baseUnitName || 'unit',
          multiplier: 1,
          price: basePrice,
        },
      ];

  return units
    .map((unit) => ({
      ...unit,
      price: deriveUnitPrice(unit, basePrice),
    }))
    .sort((a, b) => a.multiplier - b.multiplier);
};

const getUnitMeta = (item) => {
  const units = (item.units || []).slice().sort((a, b) => a.multiplier - b.multiplier);
  if (!units.length) {
    units.push({
      level: 0,
      name: 'unit',
      multiplier: 1,
      price: item.baseUnitPrice ?? item.price ?? 0,
    });
  }
  const fallback = units[0];
  const unit =
    units.find((entry) => entry.level === Number(item.unitLevel)) ||
    units[item.unitLevel] ||
    fallback;
  return { unit, baseUnit: fallback };
};

const POSPage = () => {
  const products = useInventoryStore((state) => state.products);
  const fetchProducts = useInventoryStore((state) => state.fetchProducts);
  const cart = useInventoryStore((state) => state.cart);
  const addToCart = useInventoryStore((state) => state.addToCart);
  const updateCartQuantity = useInventoryStore((state) => state.updateCartQuantity);
  const updateCartUnitLevel = useInventoryStore((state) => state.updateCartUnitLevel);
  const removeFromCart = useInventoryStore((state) => state.removeFromCart);
  const clearCart = useInventoryStore((state) => state.clearCart);
  const checkout = useInventoryStore((state) => state.checkout);
  const settings = useInventoryStore((state) => state.settings);
  const customers = useInventoryStore((state) => state.customers);
  const fetchCustomers = useInventoryStore((state) => state.fetchCustomers);
  const createCustomer = useInventoryStore((state) => state.createCustomer);

  const [search, setSearch] = useState('');
  const [unitSelections, setUnitSelections] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [customerFormError, setCustomerFormError] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [discountAmountInput, setDiscountAmountInput] = useState('0');
  const [discountNote, setDiscountNote] = useState('');
  const [amountReceived, setAmountReceived] = useState('0');
  const [dueNote, setDueNote] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const currency = settings?.currency || 'USD';

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(term) ||
        product.category?.toLowerCase().includes(term)
    );
  }, [products, search]);

  const computeLine = (item) => {
    const { unit, baseUnit } = getUnitMeta(item);
    const quantity = Number(item.quantity) || 0;
    const baseMultiplier = unit?.multiplier || 1;
    const unitPrice =
      unit?.price != null
        ? Number(unit.price)
        : (item.baseUnitPrice ?? item.price ?? 0) * baseMultiplier;
    const baseQuantity = quantity * baseMultiplier;
    const subtotal = unitPrice * quantity;
    return { unit, baseUnit, unitPrice, baseQuantity, subtotal };
  };

  const numericDiscountInput = Math.max(0, Number(discountAmountInput) || 0);

  const summary = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + computeLine(item).subtotal, 0);
    const discount = Math.min(numericDiscountInput, subtotal);
    const taxRate = settings?.taxRate ?? 0;
    const taxableSubtotal = subtotal - discount;
    const tax = taxableSubtotal * taxRate;
    return {
      subtotal,
      discount,
      taxableSubtotal,
      tax,
      total: taxableSubtotal + tax,
    };
  }, [cart, settings, numericDiscountInput]);

  useEffect(() => {
    setAmountReceived((summary.total || 0).toFixed(2));
  }, [summary.total, cart.length]);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [customers, customerSearch]);

  const selectedCustomer = customers.find((customer) => customer._id === selectedCustomerId);
  const numericAmountReceived = Math.max(0, Number(amountReceived) || 0);
  const amountDue = useMemo(
    () => Math.max(0, Number((summary.total - numericAmountReceived).toFixed(2))),
    [summary.total, numericAmountReceived]
  );

  const handleAddToCart = (product) => {
    const units = getUnits(product);
    const defaultLevel = units[0]?.level ?? 0;
    const selected = unitSelections[product._id] ?? defaultLevel;
    addToCart(product, selected);
  };

  const handleCreateCustomer = async (event) => {
    event.preventDefault();
    setCustomerFormError(null);
    if (!newCustomer.name.trim()) {
      setCustomerFormError('Name is required');
      return;
    }
    try {
      const customer = await createCustomer(newCustomer);
      setSelectedCustomerId(customer._id);
      setShowNewCustomerForm(false);
      setNewCustomer({ name: '', phone: '', email: '' });
      setCustomerSearch('');
    } catch (err) {
      setCustomerFormError(err.response?.data?.message || 'Failed to create customer');
    }
  };

  const handleCheckout = async () => {
    if (!cart.length) return;
    setStatus('loading');
    setError(null);
    setSuccess('');
    const totalBeforeCheckout = summary.total;
    if (amountDue > 0 && !selectedCustomerId) {
      setStatus('idle');
      setError('Select a customer to assign the remaining balance.');
      return;
    }
    try {
      const sale = await checkout({
        customerId: selectedCustomerId || undefined,
        amountReceived: numericAmountReceived,
        paymentMethod,
        notes,
        discountAmount: summary.discount,
        discountNote,
        dueNote: amountDue > 0 ? dueNote : undefined,
      });
      const dueMessage =
        sale?.dueAmount > 0
          ? ` Customer owes ${formatCurrency(sale.dueAmount, currency)}.`
          : '';
      setSuccess(
        `Sale completed via ${paymentMethod.toUpperCase()} for ${formatCurrency(
          totalBeforeCheckout,
          currency
        )}.${dueMessage}`
      );
      setNotes('');
      setUnitSelections({});
      setDiscountAmountInput('0');
      setDiscountNote('');
      setDueNote('');
      if (!(sale?.dueAmount > 0)) {
        setSelectedCustomerId('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Checkout failed');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold text-slate-900">Point of Sale</h2>
        <p className="text-sm text-slate-500">
          Quick checkout for counter sales — search products, pick units, and complete payment without a scanner.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="search"
              placeholder="Search products by name or category"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600"
              onClick={() => setSearch('')}
              disabled={!search}
            >
              Clear
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const units = getUnits(product);
              const selectedUnitLevel = unitSelections[product._id] ?? units[0]?.level ?? 0;
              const activeUnit =
                units.find((unit) => unit.level === selectedUnitLevel) || units[0];
              return (
                <div
                  key={product._id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-3"
                >
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded-lg border border-slate-100"
                    />
                  )}
                  <div>
                    <p className="font-semibold text-slate-900">{product.name}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">
                      {product.category}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {formatCurrency(activeUnit?.price ?? product.price, currency)} /{' '}
                      {activeUnit?.name}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {formatStockBreakdown(product)}
                    </p>
                  </div>
                  <select
                    className="border border-slate-200 rounded-lg px-2 py-2 text-sm"
                    value={selectedUnitLevel}
                    onChange={(e) =>
                      setUnitSelections((prev) => ({
                        ...prev,
                        [product._id]: Number(e.target.value),
                      }))
                    }
                  >
                    {units.map((unit) => (
                      <option key={unit.level} value={unit.level}>
                        {unit.name} · {formatCurrency(
                          unit.price ?? deriveUnitPrice(unit, product.price),
                          currency
                        )}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium"
                    onClick={() => handleAddToCart(product)}
                  >
                    Add to order
                  </button>
                </div>
              );
            })}
            {!filteredProducts.length && (
              <p className="text-sm text-slate-500 col-span-full text-center border border-dashed border-slate-300 rounded-lg py-6">
                No products match your search.
              </p>
            )}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Order Summary</h3>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={() => {
                clearCart();
                setSuccess('');
                setError(null);
                setNotes('');
                setUnitSelections({});
                setSelectedCustomerId('');
                setCustomerSearch('');
                setDiscountAmountInput('0');
                setDiscountNote('');
                setDueNote('');
                setAmountReceived('0');
              }}
            >
              New sale
            </button>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {cart.length ? (
              cart.map((item) => {
                const { unit, unitPrice, baseQuantity, baseUnit } = computeLine(item);
                return (
                  <div key={`${item.productId}-${item.unitLevel}`} className="border border-slate-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          {unit?.name} • {formatCurrency(unitPrice, currency)}
                        </p>
                        {unit?.multiplier > 1 && (
                          <p className="text-xs text-slate-400">
                            {baseQuantity.toLocaleString()} {baseUnit?.name}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-red-500"
                        onClick={() => removeFromCart(item.productId, item.unitLevel)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateCartQuantity(
                            item.productId,
                            Math.max(1, Number(e.target.value) || 1),
                            item.unitLevel
                          )
                        }
                        className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-sm"
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
                        {(item.units || []).map((unitOption) => (
                          <option key={unitOption.level} value={unitOption.level}>
                            {unitOption.name} •{' '}
                            {formatCurrency(
                              unitOption.price ??
                                deriveUnitPrice(unitOption, item.baseUnitPrice ?? item.price),
                              currency
                            )}
                          </option>
                        ))}
                      </select>
                      <p className="ml-auto font-semibold text-slate-900">
                        {formatCurrency(unitPrice * item.quantity, currency)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : null}
          </div>

          <div className="border border-slate-100 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase">Customer</p>
              <button
                type="button"
                className="text-xs text-slate-600"
                onClick={() => {
                  setShowNewCustomerForm((prev) => !prev);
                  setCustomerFormError(null);
                }}
              >
                {showNewCustomerForm ? 'Close' : 'New'}
              </button>
            </div>
            <input
              type="search"
              placeholder="Search customer"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            <select
              className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="">Walk-in (no account)</option>
              {filteredCustomers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name}
                  {customer.phone ? ` • ${customer.phone}` : ''}
                  {customer.balance > 0
                    ? ` • Owes ${formatCurrency(customer.balance, currency)}`
                    : ''}
                </option>
              ))}
            </select>
            {selectedCustomer && (
              <p className="text-xs text-amber-600">
                Outstanding balance: {formatCurrency(selectedCustomer.balance, currency)}
              </p>
            )}
            {showNewCustomerForm && (
              <form className="space-y-2 border-t border-slate-100 pt-2" onSubmit={handleCreateCustomer}>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Customer name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  required
                />
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Phone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
                <input
                  type="email"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
                {customerFormError && <p className="text-xs text-red-500">{customerFormError}</p>}
                <button
                  type="submit"
                  className="w-full bg-slate-900 text-white py-1.5 rounded-lg text-sm"
                >
                  Save customer
                </button>
              </form>
            )}
          </div>

          <div className="border border-slate-100 rounded-lg p-3 space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Discount
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={discountAmountInput}
              onChange={(e) => setDiscountAmountInput(e.target.value)}
            />
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Discount note (optional)"
              value={discountNote}
              onChange={(e) => setDiscountNote(e.target.value)}
            />
          </div>

          <div className="border border-slate-100 rounded-lg p-3 space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">
              Amount received
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Balance due now:{' '}
              <span
                className={amountDue > 0 ? 'text-amber-600 font-semibold' : 'text-slate-900'}
              >
                {formatCurrency(amountDue, currency)}
              </span>
            </p>
            {amountDue > 0 && !selectedCustomerId && (
              <p className="text-xs text-amber-600">
                Select a customer to track this outstanding balance.
              </p>
            )}
          </div>

          {amountDue > 0 && (
            <div className="border border-slate-100 rounded-lg p-3 space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">
                Due note (optional)
              </label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Note about this outstanding balance"
                value={dueNote}
                onChange={(e) => setDueNote(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(summary.subtotal, currency)}</span>
            </div>
            {summary.discount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Discount</span>
                <span>-{formatCurrency(summary.discount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">
                Tax ({((settings?.taxRate ?? 0) * 100).toFixed(2)}%) on{' '}
                {formatCurrency(summary.taxableSubtotal, currency)}
              </span>
              <span className="font-medium">{formatCurrency(summary.tax, currency)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-slate-900 border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(summary.total, currency)}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Payment Method</p>
            <div className="flex gap-2 flex-wrap">
              {['cash', 'card', 'upi'].map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${
                    paymentMethod === method
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {method.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Order note</label>
            <textarea
              rows="2"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm"
              placeholder="Optional note for the receipt"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <button
            className="w-full bg-emerald-600 text-white py-2 rounded-lg font-medium disabled:opacity-50"
            disabled={!cart.length || status === 'loading'}
            onClick={handleCheckout}
          >
            {status === 'loading'
              ? 'Processing…'
              : `Collect ${formatCurrency(numericAmountReceived, currency)}${
                  amountDue > 0 ? ' & record debt' : ''
                }`}
          </button>
        </section>
      </div>
    </div>
  );
};

const formatStockBreakdown = (product) => {
  const breakdown = product.stockBreakdown || [];
  if (!breakdown.length) {
    return `${product.quantity} units`;
  }
  return breakdown
    .filter((entry, index) => entry.quantity > 0 || index === breakdown.length - 1)
    .map((entry) => `${entry.quantity} ${entry.name}`)
    .join(', ');
};

export default POSPage;
