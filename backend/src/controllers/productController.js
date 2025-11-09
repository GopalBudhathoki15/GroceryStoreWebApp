const Product = require('../models/Product');

const buildSort = (sortKey = 'recent') => {
  switch (sortKey) {
    case 'priceAsc':
      return { price: 1 };
    case 'priceDesc':
      return { price: -1 };
    case 'stock':
      return { quantity: 1 };
    default:
      return { createdAt: -1 };
  }
};

const parseCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Price must be a positive number');
  }
  return parsed;
};

const parseQuantity = (value, { allowZero = true } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    throw new Error('Quantity must be non-negative');
  }
  return parsed;
};

const parseUnitsPayload = (rawUnits) => {
  if (rawUnits == null) {
    throw new Error('Units are required');
  }

  let units = rawUnits;
  if (typeof rawUnits === 'string') {
    try {
      units = JSON.parse(rawUnits);
    } catch (error) {
      throw new Error('Units must be valid JSON');
    }
  }

  if (!Array.isArray(units) || units.length === 0) {
    throw new Error('At least one unit definition is required');
  }
  if (units.length > 3) {
    throw new Error('A maximum of three units is supported');
  }

  const normalized = units.map((unit, index) => {
    if (!unit || !unit.name) {
      throw new Error('Each unit requires a name');
    }
    const trimmedName = unit.name.toString().trim();
    if (!trimmedName) {
      throw new Error('Each unit requires a name');
    }

    const providedMultiplier =
      Number(unit.multiplier ?? unit.size ?? unit.ratio ?? (index === 0 ? 1 : undefined));

    if (!Number.isFinite(providedMultiplier) || providedMultiplier < 1) {
      throw new Error('Unit multipliers must be numeric and at least 1');
    }

    const rawPrice =
      unit.price ?? unit.unitPrice ?? (index === 0 ? unit.basePrice ?? unit.price ?? unit.cost : undefined);
    const parsedPrice =
      rawPrice === undefined || rawPrice === '' ? null : Number(rawPrice);
    if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      throw new Error('Unit prices must be numeric and non-negative');
    }

    return {
      level: index,
      name: trimmedName,
      multiplier: index === 0 ? 1 : providedMultiplier,
      price: parsedPrice,
    };
  });

  const sorted = normalized.sort((a, b) => a.multiplier - b.multiplier);
  if (sorted[0].multiplier !== 1) {
    throw new Error('Base unit must have multiplier 1');
  }
  if (sorted[0].price == null) {
    throw new Error('Base unit price is required');
  }
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].multiplier <= sorted[i - 1].multiplier) {
      throw new Error('Each higher unit must convert to more base units than the previous level');
    }
  }

  return sorted.map((unit, index) => ({
    level: index,
    name: unit.name,
    multiplier: unit.multiplier,
    price: unit.price,
  }));
};

const getUnitByLevel = (units = [], level = 0) => {
  const numericLevel = Number(level);
  const sorted = units.slice().sort((a, b) => a.multiplier - b.multiplier);
  if (!sorted.length) {
    return { level: 0, name: 'unit', multiplier: 1 };
  }
  return sorted.find((unit) => unit.level === numericLevel) || sorted[numericLevel] || sorted[0];
};

const toBaseQuantity = (rawQuantity, units, level = 0, { allowZero = true } = {}) => {
  const quantity = parseQuantity(rawQuantity, { allowZero });
  const unit = getUnitByLevel(units, level);
  if (!unit) {
    throw new Error('Invalid unit selection');
  }
  return quantity * unit.multiplier;
};

const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      minPrice,
      maxPrice,
      stockStatus,
      sort,
    } = req.query;

    const query = {};

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    if (category) {
      query.category = { $regex: category, $options: 'i' };
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (stockStatus === 'low') {
      query.quantity = { $lt: 5 };
    } else if (stockStatus === 'out') {
      query.quantity = { $lte: 0 };
    } else if (stockStatus === 'in') {
      query.quantity = { $gt: 0 };
    }

    const products = await Product.find(query).sort(buildSort(sort));
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch product' });
  }
};

const createProduct = async (req, res) => {
  try {
    const { name, category, price, quantity, description = '', stockInputUnitLevel = 0 } = req.body;
    if (!name || !category || quantity == null) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const units = parseUnitsPayload(req.body.units);
    const baseUnit = units.find((unit) => unit.level === 0) || units[0];
    const basePrice =
      baseUnit.price != null
        ? parseCurrency(baseUnit.price)
        : price != null
          ? parseCurrency(price)
          : null;

    if (basePrice == null) {
      return res.status(400).json({ message: 'Base unit price is required' });
    }

    baseUnit.price = basePrice;
    units[0] = baseUnit;
    const normalizedQuantity = toBaseQuantity(quantity, units, stockInputUnitLevel, {
      allowZero: true,
    });

    const product = new Product({
      name,
      category,
      price: basePrice,
      quantity: normalizedQuantity,
      description,
      imageUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      units,
    });

    await product.save();
    return res.status(201).json(product);
  } catch (error) {
    if (error.message?.includes('Units') || error.message?.includes('Quantity') || error.message?.includes('Price')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to create product' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const { price, quantity, name, category, description, units: rawUnits, quantityUnitLevel } =
      req.body;

    if (name !== undefined) product.name = name;
    if (category !== undefined) product.category = category;
    if (description !== undefined) product.description = description;

    if (rawUnits !== undefined) {
      const parsedUnits = parseUnitsPayload(rawUnits);
      product.units = parsedUnits;
      const baseUnit = parsedUnits.find((unit) => unit.level === 0) || parsedUnits[0];
      if (baseUnit?.price != null) {
        product.price = parseCurrency(baseUnit.price);
      } else if (price !== undefined) {
        product.price = parseCurrency(price);
      }
    } else if (price !== undefined) {
      product.price = parseCurrency(price);
      const currentUnits = product.units || [];
      const baseUnitIndex = currentUnits.findIndex((unit) => unit.level === 0);
      if (baseUnitIndex >= 0) {
        currentUnits[baseUnitIndex].price = product.price;
        product.units = currentUnits;
      }
    }

    if (quantity !== undefined) {
      product.quantity = toBaseQuantity(quantity, product.units, quantityUnitLevel, {
        allowZero: false,
      });
    }

    if (req.file) {
      product.imageUrl = `/uploads/${req.file.filename}`;
    }

    await product.save();
    return res.json(product);
  } catch (error) {
    if (error.message?.includes('Units') || error.message?.includes('Quantity') || error.message?.includes('Price')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to update product' });
  }
};

const recordPurchase = async (req, res) => {
  try {
    const { quantity, unitLevel = 0 } = req.body;
    if (quantity == null) {
      return res.status(400).json({ message: 'Quantity is required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const delta = toBaseQuantity(quantity, product.units, unitLevel, { allowZero: false });
    product.quantity += delta;
    await product.save();

    return res.json(product);
  } catch (error) {
    if (error.message?.includes('Quantity') || error.message?.includes('unit')) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Failed to record purchase' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    return res.json({ message: 'Product deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete product' });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  recordPurchase,
};
