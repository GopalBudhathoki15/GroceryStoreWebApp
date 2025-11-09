import { useEffect, useState } from 'react';
import { useInventoryStore } from '../store/useInventoryStore.js';

const SettingsPage = () => {
  const { settings, fetchSettings, updateSettings } = useInventoryStore();
  const [form, setForm] = useState({ storeName: '', currency: 'USD', taxRate: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setForm({
        storeName: settings.storeName,
        currency: settings.currency,
        taxRate: (settings.taxRate ?? 0) * 100,
      });
    }
  }, [settings]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    await updateSettings({
      ...form,
      taxRate: Number(form.taxRate) / 100,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500">Customize the store basics</p>
      </div>

      <form className="bg-white rounded-xl shadow-sm p-4 space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700">Store Name</label>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
            value={form.storeName}
            onChange={(e) => setForm({ ...form, storeName: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Currency</label>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="NPR">NPR</option>
            <option value="INR">INR</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Tax Rate (%)</label>
          <input
            type="number"
            step="0.01"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
            value={form.taxRate}
            onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}
          />
        </div>
        <button
          type="submit"
          className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default SettingsPage;
