import { useEffect, useState } from 'react';
import { useInventoryStore } from '../store/useInventoryStore.js';
import { formatCurrency } from '../utils/number.js';

const emptyForm = {
  name: '',
  category: '',
  price: '',
  quantity: '',
  description: '',
  image: null,
  stockInputUnitLevel: 0,
};

const emptyUnitRows = [
  { name: '', conversionToPrev: 1, price: '' },
  { name: '', conversionToPrev: '', price: '' },
  { name: '', conversionToPrev: '', price: '' },
];

const buildUnitsPayload = (rows, { strict = true } = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Define at least one unit');
  }
  const normalized = [];
  let cumulative = 1;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const name = row?.name?.trim();
    if (!name) {
      if (i === 0) throw new Error('Base unit name is required');
      if (strict) break;
      continue;
    }

    let conversion = 1;
    if (i === 0) {
      cumulative = 1;
    } else {
      conversion = Number(row?.conversionToPrev);
      if (!Number.isFinite(conversion) || conversion < 1) {
        if (strict) throw new Error('Conversions must be numeric and at least 1');
        break;
      }
      cumulative *= conversion;
    }

    const rawPrice = row?.price;
    const parsedPrice =
      rawPrice === '' || rawPrice === null || rawPrice === undefined ? null : Number(rawPrice);
    if (i === 0 && (parsedPrice === null || !Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      throw new Error('Base unit price is required');
    }
    if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      throw new Error('Unit prices must be numeric and non-negative');
    }

    normalized.push({
      level: normalized.length,
      name,
      multiplier: cumulative,
      price: parsedPrice,
      conversionToPrev: conversion,
    });
  }

  if (!normalized.length) {
    throw new Error('Define at least the base unit');
  }
  return normalized;
};

const hydrateUnitRows = (units = [], basePrice) => {
  const rows = emptyUnitRows.map((row) => ({ ...row }));
  const sorted = (units || []).slice().sort((a, b) => a.level - b.level);

  if (!sorted.length) {
    if (basePrice != null) rows[0].price = basePrice;
    return rows;
  }

  sorted.forEach((unit, index) => {
    if (index === 0) {
      rows[0] = {
        name: unit.name,
        conversionToPrev: 1,
        price:
          unit.price != null
            ? unit.price
            : basePrice != null
              ? basePrice
              : '',
      };
    } else {
      const prev = sorted[index - 1];
      const ratio = prev ? unit.multiplier / prev.multiplier : unit.multiplier;
      rows[index] = {
        name: unit.name,
        conversionToPrev: Number(ratio) || '',
        price:
          unit.price != null
            ? unit.price
            : basePrice != null
              ? deriveUnitPrice(unit, basePrice)
              : '',
      };
    }
  });

  if (!rows[0].price && basePrice != null) {
    rows[0].price = basePrice;
  }

  return rows;
};

const getProductUnits = (product) =>
  (product.units || []).slice().sort((a, b) => a.multiplier - b.multiplier);

const formatStockBreakdown = (product) => {
  const breakdown = product.stockBreakdown || [];
  if (!breakdown.length) return `${product.quantity} units`;
  return breakdown
    .filter((entry, index) => entry.quantity > 0 || index === breakdown.length - 1)
    .map((entry) => `${entry.quantity} ${entry.name}`)
    .join(', ');
};

const previewUnitsFromRows = (rows) => {
  try {
    return buildUnitsPayload(rows, { strict: false });
  } catch {
    return [
      {
        level: 0,
        name: rows[0]?.name || 'unit',
        multiplier: 1,
        price:
          rows[0]?.price === '' || rows[0]?.price == null ? null : Number(rows[0]?.price),
      },
    ];
  }
};

const deriveUnitPrice = (unit, basePrice) => {
  const numericBase = Number(basePrice) || 0;
  const multiplier = unit?.multiplier || 1;
  return unit?.price != null ? Number(unit.price) : numericBase * multiplier;
};

const ProductsPage = () => {
  const [form, setForm] = useState(emptyForm);
  const [unitRows, setUnitRows] = useState(emptyUnitRows);
  const [editingId, setEditingId] = useState(null);
  const [restockInputs, setRestockInputs] = useState({});
  const [cartUnitSelections, setCartUnitSelections] = useState({});
  const [formError, setFormError] = useState(null);
  const products = useInventoryStore((state) => state.products);
  const filters = useInventoryStore((state) => state.filters);
  const loading = useInventoryStore((state) => state.loading);
  const fetchProducts = useInventoryStore((state) => state.fetchProducts);
  const createProduct = useInventoryStore((state) => state.createProduct);
  const updateProduct = useInventoryStore((state) => state.updateProduct);
  const deleteProduct = useInventoryStore((state) => state.deleteProduct);
  const addToCart = useInventoryStore((state) => state.addToCart);
  const recordPurchase = useInventoryStore((state) => state.recordPurchase);
  const settings = useInventoryStore((state) => state.settings);
  const setFilters = useInventoryStore((state) => state.setFilters);

  useEffect(() => {
    fetchProducts(filters);
  }, [fetchProducts, filters]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    try {
      const unitsPayload = buildUnitsPayload(unitRows);
      const payload = { ...form, units: unitsPayload, price: unitsPayload[0]?.price ?? form.price };

      if (editingId) {
        payload.quantityUnitLevel = form.stockInputUnitLevel;
        delete payload.stockInputUnitLevel;
        await updateProduct(editingId, payload);
      } else {
        payload.stockInputUnitLevel = form.stockInputUnitLevel;
        await createProduct(payload);
      }

      setForm(emptyForm);
      setUnitRows(emptyUnitRows);
      setEditingId(null);
    } catch (error) {
      setFormError(error.message || 'Failed to save product');
    }
  };

  const startEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name,
      category: product.category,
      price: product.price,
      quantity: product.quantity,
      description: product.description || '',
      image: null,
      stockInputUnitLevel: 0,
    });
    const hydratedUnits = hydrateUnitRows(product.units, product.price);
    if (!product.units?.length) {
      hydratedUnits[0] = {
        ...hydratedUnits[0],
        name: 'unit',
        price: product.price ?? '',
      };
    }
    setUnitRows(hydratedUnits);
  };

  const restockState = (productId, units = []) =>
    restockInputs[productId] || { quantity: '', unitLevel: units[0]?.level ?? 0 };

  const cartUnitSelection = (productId, units = []) =>
    cartUnitSelections[productId] ?? units[0]?.level ?? 0;

  const handleRestockChange = (productId, field, value, units = []) => {
    setRestockInputs((prev) => ({
      ...prev,
      [productId]: { ...restockState(productId, units), [field]: value },
    }));
  };

  const handleRestockSubmit = async (productId, units = []) => {
    const { quantity, unitLevel } = restockState(productId, units);
    const parsedQuantity = Number(quantity);
    if (!quantity || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) return;
    try {
      await recordPurchase(productId, { quantity: parsedQuantity, unitLevel });
      setRestockInputs((prev) => ({
        ...prev,
        [productId]: { quantity: '', unitLevel: units[0]?.level ?? 0 },
      }));
    } catch (error) {
      console.error(error);
    }
  };

  const previewUnits = previewUnitsFromRows(unitRows);
  const currency = settings?.currency || 'USD';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Products</h2>
          <p className="text-sm text-slate-500">Manage catalog and inventory</p>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search name or category"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={filters.stockStatus}
            onChange={(e) => setFilters({ stockStatus: e.target.value })}
          >
            <option value="all">All stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="in">In stock</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form className="bg-white rounded-xl shadow-sm p-4 space-y-4 lg:col-span-1" onSubmit={handleSubmit}>
          <h3 className="font-semibold text-slate-900">{editingId ? 'Edit Product' : 'Add Product'}</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Category</label>
            <input
              type="text"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Units of measure</p>
              <span className="text-xs text-slate-500">Up to 3 levels</span>
            </div>
            {unitRows.map((row, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Level {index + 1} {index === 0 && '(Base)'}
                  </label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
                    value={row.name}
                    onChange={(e) => {
                      const next = unitRows.map((unit, idx) =>
                        idx === index ? { ...unit, name: e.target.value } : unit
                      );
                      setUnitRows(next);
                    }}
                    required={index === 0}
                  />
                </div>
                {index > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Conversion (1 level {index + 1} = ? level {index})
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
                      value={row.conversionToPrev}
                      onChange={(e) => {
                        const next = unitRows.map((unit, idx) =>
                          idx === index ? { ...unit, conversionToPrev: e.target.value } : unit
                        );
                        setUnitRows(next);
                      }}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      1 {row.name || `level ${index + 1}`} = {row.conversionToPrev || '?'}{' '}
                      {unitRows[index - 1].name || `level ${index}`}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Price ({row.name || (index === 0 ? 'Base unit' : `Level ${index + 1}`)})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
                    value={row.price ?? ''}
                    onChange={(e) => {
                      const next = unitRows.map((unit, idx) =>
                        idx === index ? { ...unit, price: e.target.value } : unit
                      );
                      setUnitRows(next);
                      if (index === 0) {
                        setForm((prev) => ({ ...prev, price: e.target.value }));
                      }
                    }}
                    required={index === 0}
                  />
                </div>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Quantity</label>
            <div className="flex gap-2 mt-1">
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
              <select
                className="border border-slate-200 rounded-lg px-2 py-2 text-sm"
                value={form.stockInputUnitLevel}
                onChange={(e) =>
                  setForm({ ...form, stockInputUnitLevel: Number(e.target.value) })
                }
              >
                {previewUnits.map((unit) => (
                  <option key={unit.level} value={unit.level}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 mt-1"
              rows="3"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Image</label>
            <input
              type="file"
              accept="image/*"
              className="w-full mt-1 text-sm"
              onChange={(e) => setForm({ ...form, image: e.target.files[0] })}
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-slate-900 text-white py-2 rounded-lg font-medium"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setUnitRows(emptyUnitRows);
                  setFormError(null);
                }}
                className="flex-1 border border-slate-200 text-slate-700 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm">
            <div className="border-b px-4 py-2 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Product List</h3>
              {loading && <span className="text-sm text-slate-500">Loading...</span>}
            </div>
            <div className="divide-y">
{products.map((product) => {
                const productUnits = getProductUnits(product);
                const baseUnit = productUnits[0]?.name || 'unit';
                const stockSummary = formatStockBreakdown(product);
                const unitDefinitions = productUnits.length
                  ? productUnits
                      .map((unit, index) => {
                        const unitPriceValue = deriveUnitPrice(unit, product.price);
                        const priceLabel = formatCurrency(unitPriceValue, currency);
                        if (index === 0) {
                          return `${unit.name} (base • ${priceLabel})`;
                        }
                        const prev = productUnits[index - 1];
                        const ratio = prev ? unit.multiplier / prev.multiplier : unit.multiplier;
                        return `1 ${unit.name} • ${priceLabel} = ${Number(ratio).toLocaleString()} ${
                          prev?.name || ''
                        }`.trim();
                      })
                      .join(' • ')
                  : `unit (base • ${formatCurrency(product.price, currency)})`;
                const unitsForRestock = (productUnits.length
                  ? productUnits
                  : [
                      {
                        level: 0,
                        name: product.baseUnitName || 'unit',
                        multiplier: 1,
                      },
                    ]
                ).map((unit) => ({
                  ...unit,
                  price: deriveUnitPrice(unit, product.price),
                }));
                const currentRestock = restockState(product._id, unitsForRestock);

                return (
                  <div key={product._id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                      )}
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-sm text-slate-500">{product.category}</p>
                        <p className="text-sm text-slate-500">
                          {formatCurrency(product.price, currency)} / {baseUnit}
                        </p>
                        <p className="text-sm text-slate-500">{stockSummary}</p>
                        <p className="text-xs text-slate-400">{unitDefinitions}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-sm"
                          value={currentRestock.quantity}
                          onChange={(e) =>
                            handleRestockChange(
                              product._id,
                              'quantity',
                              e.target.value,
                              unitsForRestock
                            )
                          }
                          placeholder="Qty"
                        />
                        <select
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
                          value={currentRestock.unitLevel}
                          onChange={(e) =>
                            handleRestockChange(
                              product._id,
                              'unitLevel',
                              Number(e.target.value),
                              unitsForRestock
                            )
                          }
                        >
                          {unitsForRestock.map((unit) => (
                            <option key={unit.level} value={unit.level}>
                              {unit.name} • {formatCurrency(deriveUnitPrice(unit, product.price), currency)}
                            </option>
                          ))}
                        </select>
                        <button
                          className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-sm"
                          type="button"
                          onClick={() => handleRestockSubmit(product._id, unitsForRestock)}
                        >
                          Restock
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap items-center">
                        <select
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
                          value={cartUnitSelection(product._id, unitsForRestock)}
                          onChange={(e) =>
                            setCartUnitSelections((prev) => ({
                              ...prev,
                              [product._id]: Number(e.target.value),
                            }))
                          }
                        >
                          {unitsForRestock.map((unit) => (
                            <option key={unit.level} value={unit.level}>
                              {unit.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="px-3 py-1 border border-slate-200 rounded-lg text-sm"
                          onClick={() =>
                            addToCart(product, cartUnitSelection(product._id, unitsForRestock))
                          }
                        >
                          Add to cart
                        </button>
                        <button
                          className="px-3 py-1 border border-slate-200 rounded-lg text-sm"
                          onClick={() => startEdit(product)}
                        >
                          Edit
                        </button>
                        <button
                          className="px-3 py-1 border border-red-200 text-red-600 rounded-lg text-sm"
                          onClick={() => deleteProduct(product._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!products.length && (
                <p className="p-6 text-sm text-slate-500 text-center">No products yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
