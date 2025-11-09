import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import LoginPage from './pages/Login.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import DashboardPage from './pages/Dashboard.jsx';
import ProductsPage from './pages/Products.jsx';
import ReportsPage from './pages/Reports.jsx';
import SettingsPage from './pages/Settings.jsx';
import CartPage from './pages/Cart.jsx';
import POSPage from './pages/POS.jsx';
import RequireRole from './components/RequireRole.jsx';
import CustomersPage from './pages/Customers.jsx';

const App = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <DashboardLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route
          index
          element={
            <RequireRole roles={['admin']}>
              <DashboardPage />
            </RequireRole>
          }
        />
        <Route
          path="products"
          element={
            <RequireRole roles={['admin']}>
              <ProductsPage />
            </RequireRole>
          }
        />
        <Route
          path="pos"
          element={
            <RequireRole roles={['admin', 'staff']}>
              <POSPage />
            </RequireRole>
          }
        />
        <Route
          path="customers"
          element={
            <RequireRole roles={['admin']}>
              <CustomersPage />
            </RequireRole>
          }
        />
        <Route
          path="reports"
          element={
            <RequireRole roles={['admin']}>
              <ReportsPage />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole roles={['admin']}>
              <SettingsPage />
            </RequireRole>
          }
        />
        <Route
          path="cart"
          element={
            <RequireRole roles={['admin']}>
              <CartPage />
            </RequireRole>
          }
        />
      </Route>
    </Routes>
  );
};

export default App;
