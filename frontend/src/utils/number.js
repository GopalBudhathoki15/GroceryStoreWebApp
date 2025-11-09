export const formatCurrency = (value, currency = 'USD') => {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(safeValue);
};
