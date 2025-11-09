const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  recordPurchase,
} = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const requireRoles = require('../middleware/roleMiddleware');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) =>
    cb(null, path.join(__dirname, '..', '..', '..', 'uploads')),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${file.originalname.replace(/\s+/g, '')}`;
    cb(null, unique);
  },
});

const upload = multer({ storage });

router.use(authMiddleware);

router.get('/', requireRoles(['admin', 'staff']), getProducts);
router.get('/:id', requireRoles(['admin', 'staff']), getProduct);
router.post('/', requireRoles(['admin']), upload.single('image'), createProduct);
router.put('/:id', requireRoles(['admin']), upload.single('image'), updateProduct);
router.post('/:id/purchase', requireRoles(['admin']), recordPurchase);
router.delete('/:id', requireRoles(['admin']), deleteProduct);

module.exports = router;
