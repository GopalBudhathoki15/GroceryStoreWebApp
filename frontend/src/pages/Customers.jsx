import { useEffect, useMemo, useState } from 'react';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { formatCurrency } from '../utils/number.js';

const emptyCustomerForm = { name: '', phone: '', email: '', address: '', notes: '' };

const CustomersPage = () => {
  const customers = useInventoryStore((state) => state.customers);
  const fetchCustomers = useInventoryStore((state) => state.fetchCustomers);
  const createCustomer = useInventoryStore((state) => state.createCustomer);
  const updateCustomer = useInventoryStore((state) => state.updateCustomer);
  const deleteCustomer = useInventoryStore((state) => state.deleteCustomer);
  const recordCustomerPayment = useInventoryStore((state) => state.recordCustomerPayment);
  const getCustomerDetails = useInventoryStore((state) => state.getCustomerDetails);
  const settings = useInventoryStore((state) => state.settings);

  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyCustomerForm);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [paymentState, setPaymentState] = useState(null); // { customer }
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash', note: '' });
  const [paymentError, setPaymentError] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState(null);
  const [detailsStatus, setDetailsStatus] = useState('idle');
  const [status, setStatus] = useState('idle');
  const currency = settings?.currency || 'USD';

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [customers, search]);

  const resetForm = () => {
    setForm(emptyCustomerForm);
    setEditingId(null);
  };

  const handleSubmitCustomer = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    setStatus('saving');
    try {
      if (editingId) {
        await updateCustomer(editingId, form);
      } else {
        await createCustomer(form);
      }
      resetForm();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setStatus('idle');
    }
  };

  const openPaymentForm = (customer) => {
    setPaymentState(customer);
    setPaymentForm({ amount: '', method: 'cash', note: '' });
    setPaymentError(null);
  };

  const handlePaymentSubmit = async (event) => {
    event.preventDefault();
    if (!paymentState) return;
    setPaymentError(null);
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Payment amount must be greater than zero');
      return;
    }
    try {
      await recordCustomerPayment(paymentState._id, {
        amount,
        method: paymentForm.method,
        note: paymentForm.note,
      });
      if (details?.customer?._id === paymentState._id) {
        await loadDetails(paymentState._id);
      }
      setPaymentState(null);
      setPaymentForm({ amount: '', method: 'cash', note: '' });
    } catch (err) {
      setPaymentError(err.response?.data?.message || 'Failed to record payment');
    }
  };

  const handleDeleteCustomer = async (customer) => {
    if (customer.balance > 0) {
      setFormError('Clear outstanding balance before deleting a customer.');
      return;
    }
    if (!window.confirm(`Delete ${customer.name}? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteCustomer(customer._id);
      if (details?.customer?._id === customer._id) {
        setDetails(null);
      }
      if (editingId === customer._id) {
        resetForm();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  const loadDetails = async (id) => {
    setDetailsStatus('loading');
    setDetailsError(null);
    try {
      const data = await getCustomerDetails(id);
      setDetails(data);
      return data;
    } catch (err) {
      setDetailsError(err.response?.data?.message || 'Failed to load customer history');
      throw err;
    } finally {
      setDetailsStatus('idle');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Customers & Receivables</h2>
        <p className="text-sm text-slate-500">
          Track customer balances, add new accounts, and record payments toward outstanding sales.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <form className="bg-white rounded-xl shadow-sm p-4 space-y-3" onSubmit={handleSubmitCustomer}>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              {editingId ? 'Edit Customer' : 'Add Customer'}
            </h3>
            {editingId && (
              <button
                type="button"
                className="text-xs text-slate-500"
                onClick={resetForm}
              >
                Cancel edit
              </button>
            )}
          </div>
          {['name', 'phone', 'email'].map((field) => (
            <div key={field}>
              <label className="block text-sm text-slate-600 capitalize">{field}</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm"
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required={field === 'name'}
              />
            </div>
          ))}
          <div>
            <label className="block text-sm text-slate-600">Address</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600">Notes</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm"
              rows="2"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            disabled={status === 'saving'}
          >
            {status === 'saving' ? 'Saving…' : editingId ? 'Update customer' : 'Save customer'}
          </button>
        </form>

        <section className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="search"
              placeholder="Search by name, phone, or email"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600"
              onClick={() => setSearch('')}
              disabled={!search}
            >
              Clear
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-500">
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Contact</th>
                  <th className="py-2 px-3">Balance</th>
                  <th className="py-2 px-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer._id} className="border-b last:border-b-0">
                    <td className="py-2 px-3 text-slate-900 font-medium">{customer.name}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {customer.phone || '--'}
                      <br />
                      <span className="text-xs text-slate-500">{customer.email || ''}</span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {formatCurrency(customer.balance || 0, currency)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="px-3 py-1 text-xs border border-slate-200 rounded-lg"
                          onClick={() => loadDetails(customer._id)}
                        >
                          History
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1 text-xs border border-slate-200 rounded-lg"
                          onClick={() => openPaymentForm(customer)}
                          disabled={customer.balance <= 0}
                        >
                          Record payment
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1 text-xs border border-slate-200 rounded-lg"
                          onClick={() => {
                            setEditingId(customer._id);
                            setForm({
                              name: customer.name || '',
                              phone: customer.phone || '',
                              email: customer.email || '',
                              address: customer.address || '',
                              notes: customer.notes || '',
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1 text-xs border border-red-200 text-red-600 rounded-lg"
                          onClick={() => handleDeleteCustomer(customer)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredCustomers.length && (
                  <tr>
                    <td colSpan="4" className="py-4 text-center text-slate-500">
                      No customers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {details && (
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 border border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              {details.customer.name} – History
            </h3>
            <button
              type="button"
              className="text-sm text-slate-500"
              onClick={() => setDetails(null)}
            >
              Close
            </button>
          </div>
          {detailsError && <p className="text-sm text-red-600">{detailsError}</p>}
          {detailsStatus === 'loading' ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <div>
                <h4 className="text-sm font-semibold text-slate-700">Open invoices</h4>
                {details.openSales?.length ? (
                  <ul className="mt-2 space-y-2 text-sm">
                    {details.openSales.map((sale) => (
                      <li key={sale._id} className="border border-amber-100 rounded-lg p-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-900">
                            {formatCurrency(sale.dueAmount, currency)} due
                          </p>
                          <p className="text-xs text-slate-500">
                            #{sale._id.slice(-6)} • {new Date(sale.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <ul className="text-xs text-slate-600 space-y-1">
                          {sale.items?.map((item) => (
                            <li key={`${sale._id}-${item.productId}-${item.unitLevel}`}>
                              {item.name} — {item.unitQuantity} {item.unitLabel} (
                              {formatCurrency(item.subtotal, currency)})
                            </li>
                          ))}
                        </ul>
                        <div className="text-xs text-slate-500 space-y-1">
                          <p>
                            Total: {formatCurrency(sale.total, currency)} • Paid:{' '}
                            {formatCurrency(sale.paidAmount, currency)}
                          </p>
                          {sale.discountAmount > 0 && (
                            <p>
                              Discount: -{formatCurrency(sale.discountAmount, currency)}{' '}
                              {sale.discountNote ? `(${sale.discountNote})` : ''}
                            </p>
                          )}
                          {sale.dueNote && <p>Due note: {sale.dueNote}</p>}
                          {sale.notes && <p>Order note: {sale.notes}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">No outstanding invoices 🎉</p>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700">Recent sales</h4>
                {details.recentSales?.length ? (
                  <div className="overflow-x-auto mt-2">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="py-1 pr-2">Date</th>
                          <th className="py-1 pr-2">Total</th>
                          <th className="py-1 pr-2">Paid</th>
                          <th className="py-1 pr-2">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.recentSales.map((sale) => (
                          <tr key={sale._id} className="border-t">
                            <td className="py-1 pr-2">
                              {new Date(sale.createdAt).toLocaleString()}
                            </td>
                            <td className="py-1 pr-2">{formatCurrency(sale.total, currency)}</td>
                            <td className="py-1 pr-2">{formatCurrency(sale.paidAmount, currency)}</td>
                            <td className="py-1 pr-2">
                              <span
                                className={
                                  sale.dueAmount > 0 ? 'text-amber-600 font-semibold' : ''
                                }
                              >
                                {formatCurrency(sale.dueAmount, currency)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">No sales yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {paymentState && (
        <form
          className="bg-white rounded-xl shadow-sm p-4 space-y-3 border border-slate-200"
          onSubmit={handlePaymentSubmit}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              Record payment – {paymentState.name}
            </h3>
            <button type="button" className="text-sm text-slate-500" onClick={() => setPaymentState(null)}>
              Close
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="block text-sm text-slate-600">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-sm text-slate-600">Method</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm"
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
              >
                {['cash', 'card', 'upi'].map((method) => (
                  <option key={method} value={method}>
                    {method.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-sm text-slate-600">Note</label>
              <input
                type="text"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          {paymentError && <p className="text-sm text-red-600">{paymentError}</p>}
          <button
            type="submit"
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Record payment
          </button>
        </form>
      )}
    </div>
  );
};

export default CustomersPage;
