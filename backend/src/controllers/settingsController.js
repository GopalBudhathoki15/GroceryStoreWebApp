const Setting = require('../models/Setting');

const ensureSettings = async () => {
  const existing = await Setting.findOne();
  if (existing) return existing;
  return Setting.create({});
};

const getSettings = async (_req, res) => {
  try {
    const settings = await ensureSettings();
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const settings = await ensureSettings();
    const { storeName, currency, taxRate } = req.body;
    if (storeName !== undefined) settings.storeName = storeName;
    if (currency !== undefined) settings.currency = currency;
    if (taxRate !== undefined) settings.taxRate = taxRate;
    await settings.save();
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update settings' });
  }
};

module.exports = { getSettings, updateSettings };
