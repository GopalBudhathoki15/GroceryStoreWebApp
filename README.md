## Pasal – Local Grocery Manager

Full-stack inventory, cart, and reporting app for a single-store admin. Runs entirely on your machine with a Node/Express API, MongoDB, and a React + Tailwind dashboard.

### Requirements

- Node.js 18+
- Local MongoDB instance running on `mongodb://127.0.0.1:27017`

### Environment

1. Copy `.env.example` to `.env` at the repo root and adjust values.
   ```env
   PORT=5001
   MONGO_URI=mongodb://127.0.0.1:27017/pasal
   JWT_SECRET=choose_a_secret
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=supersecure
   STAFF_USERNAME=staff
   STAFF_PASSWORD=staffpass
   STAFF_NAME=Front Desk
   ```
2. The backend reads uploads from `<repo>/uploads`. The folder already exists with a `.gitkeep`.

### Install & Run

```bash
# Backend
cd backend
npm install
npm run dev   # http://localhost:5001

# Frontend (new terminal)
cd frontend
npm install
npm run dev   # http://localhost:3000
```

The Vite dev server proxies `/api` and `/uploads` calls to the Express server, so once both processes are running you get a fully functional dashboard.

### Features Delivered

- Role-based access (admins get full control; staff accounts can use the POS workspace for day-to-day sales without touching admin settings)
- Secure login (env-based credentials + JWT)
- Multi-unit (up to 3 levels) inventory tracking with per-unit pricing plus conversion-aware purchases and sales
- Product CRUD with image uploads (stored locally) plus search, stock filters, and low-stock alerts
- Customer account tracking with receivables, debt recording, and payment history (including Customers page for payments/creation)
- Dedicated POS screen (quick product search, unit selection, payment capture, manual discounts, and on-account sales)
- Inventory dashboard with KPIs, low-stock list, and top-selling items
- Sales history + CSV/JSON export
- Settings page for store name, currency, and tax rate

### Project Structure

```
backend/
  src/
    config/     # Mongo connection
    controllers # Route handlers
    middleware  # Auth guard
    models      # Mongoose schemas
    routes      # API endpoints
    utils       # CSV exporter
frontend/
  src/
    api/        # Axios client
    context/    # Auth provider
    pages/      # Views (dashboard, products, cart, reports, settings)
    store/      # Zustand store for data + cart
uploads/        # Local product images (served statically)
```

### Available API Routes

- `POST /api/auth/login` – obtain JWT
- `GET /api/products` plus standard CRUD routes
- `POST /api/products/:id/purchase` – restock inventory in retail or bulk units
- `POST /api/sales/checkout`, `GET /api/sales`, `GET /api/sales/export`
- `GET /api/dashboard` for metrics
- `GET/PUT /api/settings`

All routes except `/api/auth` require the `Authorization: Bearer <token>` header.
