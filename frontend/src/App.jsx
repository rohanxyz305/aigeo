import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Landing from './pages/Landing.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';
import Dashboard from './pages/Dashboard.jsx';

function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  return children;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/app" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<GuestOnly><SignIn /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><SignUp /></GuestOnly>} />
      <Route path="/app" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
