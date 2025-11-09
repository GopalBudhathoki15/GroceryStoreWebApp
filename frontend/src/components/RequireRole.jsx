import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const RequireRole = ({ roles, children }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    const fallback = user.role === 'staff' ? '/pos' : '/';
    return <Navigate to={fallback} replace />;
  }
  return children;
};

export default RequireRole;
