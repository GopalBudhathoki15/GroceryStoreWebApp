import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useInventoryStore } from '../store/useInventoryStore.js';

const navItems = [
  { to: '/', label: 'Dashboard', roles: ['admin'] },
  { to: '/pos', label: 'Point of Sale', roles: ['admin', 'staff'] },
  { to: '/customers', label: 'Customers', roles: ['admin'] },
  { to: '/products', label: 'Products', roles: ['admin'] },
  { to: '/cart', label: 'Cart & Checkout', roles: ['admin'] },
  { to: '/reports', label: 'Reports', roles: ['admin'] },
  { to: '/settings', label: 'Settings', roles: ['admin'] },
];

const DashboardLayout = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { settings, fetchSettings } = useInventoryStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-60 bg-white shadow-sm">
        <div className="p-6 border-b">
          <p className="text-xl font-semibold text-slate-800">{settings?.storeName || 'Pasal Admin'}</p>
          <p className="text-xs text-slate-500">Inventory Console</p>
        </div>
        <nav className="p-4 space-y-2">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(user?.role))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm font-medium ${
                    isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="mt-auto p-4">
          <button
            className="w-full border border-slate-200 rounded-md py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
