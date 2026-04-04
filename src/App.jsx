import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import ChatWidget from './components/ChatWidget';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import MatchDetail from './pages/MatchDetail';
import MyContests from './pages/MyContests';
import MyBets from './pages/MyBets';
import Wallet from './pages/Wallet';
import Profile from './pages/Profile';
import AdminLayout from './admin/AdminLayout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="main-content"><div className="loading-spinner"><div className="spinner" /></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <Header />
      <div className="app-layout">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/match/:matchId" element={<ProtectedRoute><MatchDetail /></ProtectedRoute>} />
          <Route path="/my-contests" element={<ProtectedRoute><MyContests /></ProtectedRoute>} />
          <Route path="/my-bets" element={<ProtectedRoute><MyBets /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {user && user.role !== 'admin' && <ChatWidget />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
