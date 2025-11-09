import { create } from 'zustand';
import { client } from '../api/client';

const buildFormData = (payload) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const isFile = typeof File !== 'undefined' && value instanceof File;
    const isBlob = typeof Blob !== 'undefined' && value instanceof Blob;
    if (isFile || isBlob) {
      formData.append(key, value);
    } else if (typeof value === 'object') {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, value);
    }
  });
  return formData;
};

const normalizeUnitsForCart = (product) => {
  const basePrice = Number(product.price) || 0;
  const unitsSource =
    product.units?.length > 0
      ? product.units
      : [
          {
            level: 0,
            name: product.baseUnitName || 'unit',
            multiplier: 1,
            price: basePrice,
          },
        ];

  return unitsSource.map((unit) => ({
    ...unit,
    price:
      unit.price != null
        ? Number(unit.price)
        : basePrice * (unit.multiplier || 1),
  }));
};

export const useInventoryStore = create((set, get) => ({
  products: [],
  sales: [],
  dashboard: null,
  settings: null,
  customers: [],
  loading: false,
  filters: {
    search: '',
    category: '',
    stockStatus: 'all',
  },
  cart: [],

  setFilters: (filters) => set({ filters: { ...get().filters, ...filters } }),

  fetchProducts: async (params = {}) => {
    set({ loading: true });
    try {
      const response = await client.get('/products', { params });
      set({ products: response.data });
    } catch (error) {
      console.error(error);
    } finally {
      set({ loading: false });
    }
  },

  createProduct: async (payload) => {
    const formData = buildFormData(payload);
    await client.post('/products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await Promise.all([
      get().fetchProducts(get().filters),
      get().fetchDashboard(),
    ]);
  },

  updateProduct: async (id, payload) => {
    const formData = buildFormData(payload);
    await client.put(`/products/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await Promise.all([
      get().fetchProducts(get().filters),
      get().fetchDashboard(),
    ]);
  },

  deleteProduct: async (id) => {
    await client.delete(`/products/${id}`);
    set({ products: get().products.filter((product) => product._id !== id) });
  },

  fetchDashboard: async () => {
    try {
      const response = await client.get('/dashboard');
      set({ dashboard: response.data });
    } catch (error) {
      if (error.response?.status !== 403) {
        console.error(error);
      }
    }
  },

  fetchSales: async () => {
    try {
      const response = await client.get('/sales');
      set({ sales: response.data });
    } catch (error) {
      if (error.response?.status !== 403) {
        console.error(error);
      }
    }
  },

  fetchSettings: async () => {
    try {
      const response = await client.get('/settings');
      set({ settings: response.data });
    } catch (error) {
      console.error(error);
    }
  },

  updateSettings: async (payload) => {
    try {
      const response = await client.put('/settings', payload);
      set({ settings: response.data });
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  fetchCustomers: async () => {
    try {
      const response = await client.get('/customers');
      set({ customers: response.data });
    } catch (error) {
      if (error.response?.status !== 403) {
        console.error(error);
      }
    }
  },

  createCustomer: async (payload) => {
    try {
      const response = await client.post('/customers', payload);
      await get().fetchCustomers();
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  updateCustomer: async (id, payload) => {
    try {
      const response = await client.put(`/customers/${id}`, payload);
      await get().fetchCustomers();
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  deleteCustomer: async (id) => {
    try {
      await client.delete(`/customers/${id}`);
      await get().fetchCustomers();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  recordCustomerPayment: async (id, payload) => {
    try {
      const response = await client.post(`/customers/${id}/payments`, payload);
      await Promise.all([
        get().fetchCustomers(),
        get().fetchSales(),
        get().fetchDashboard(),
      ]);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  getCustomerDetails: async (id) => {
    try {
      const response = await client.get(`/customers/${id}`);
      return response.data;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  recordPurchase: async (productId, payload) => {
    await client.post(`/products/${productId}/purchase`, payload);
    await Promise.all([
      get().fetchProducts(get().filters),
      get().fetchDashboard(),
    ]);
  },

  addToCart: (product, preferredUnitLevel) =>
    set((state) => {
      const normalizedUnits = normalizeUnitsForCart(product);

      const defaultUnitLevel = normalizedUnits.find((unit) => unit.level === 0)?.level ?? 0;
      const chosenUnitLevel = preferredUnitLevel ?? defaultUnitLevel;

      const existingIndex = state.cart.findIndex(
        (item) => item.productId === product._id && item.unitLevel === chosenUnitLevel
      );

      if (existingIndex !== -1) {
        return {
          cart: state.cart.map((item, index) =>
            index === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
          ),
        };
      }

      return {
        cart: [
          ...state.cart,
          {
            productId: product._id,
            name: product.name,
            price: product.price,
            baseUnitPrice: product.price,
            quantity: 1,
            unitLevel: chosenUnitLevel,
            units: normalizedUnits,
            imageUrl: product.imageUrl,
          },
        ],
      };
    }),

  removeFromCart: (id, unitLevel) =>
    set((state) => ({
      cart: state.cart.filter((item) => {
        if (item.productId !== id) return true;
        if (unitLevel === undefined || unitLevel === null) return false;
        return item.unitLevel !== unitLevel;
      }),
    })),

  updateCartQuantity: (id, quantity, unitLevel) =>
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.productId !== id) return item;
        if (unitLevel !== undefined && unitLevel !== null && item.unitLevel !== unitLevel) {
          return item;
        }
        return { ...item, quantity: Math.max(1, quantity) };
      }),
    })),

  updateCartUnitLevel: (id, unitLevel, previousUnitLevel) =>
    set((state) => ({
      cart: state.cart.map((item) => {
        if (item.productId !== id) return item;
        if (
          previousUnitLevel !== undefined &&
          previousUnitLevel !== null &&
          item.unitLevel !== previousUnitLevel
        ) {
          return item;
        }
        return { ...item, unitLevel };
      }),
    })),

  clearCart: () => set({ cart: [] }),

  checkout: async (options = {}) => {
    const { cart } = get();
    if (cart.length === 0) return null;
    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitLevel: item.unitLevel,
        })),
      };

      if (options.customerId) payload.customerId = options.customerId;
      if (options.customerName) payload.customerName = options.customerName;
      if (options.amountReceived !== undefined) payload.amountReceived = options.amountReceived;
      if (options.paymentMethod) payload.paymentMethod = options.paymentMethod;
      if (options.notes) payload.notes = options.notes;

      const response = await client.post('/sales/checkout', payload);
      set({ cart: [] });
      await Promise.all([
        get().fetchProducts(get().filters),
        get().fetchSales(),
        get().fetchDashboard(),
      ]);
      const refreshCustomers = get().fetchCustomers;
      if (typeof refreshCustomers === 'function') {
        refreshCustomers();
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  },
}));
