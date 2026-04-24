import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ChatWidget from './components/ChatWidget';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import BetMatch from './pages/BetMatch';
import MyBets from './pages/MyBets';
import Wallet from './pages/Wallet';
import Profile from './pages/Profile';
import GamesLobby from './pages/games/GamesLobby';
import ColorGame from './pages/games/ColorGame';
import CoinFlip from './pages/games/CoinFlip';
import Aviator from './pages/games/Aviator';
import AdminLayout from './admin/AdminLayout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="main-content"><div className="loading-spinner"><div className="spinner" /></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/register';

  return (
    <>
      <Header />
      <div className={`app-layout ${!isAdmin && !isAuthPage ? 'has-bottom-nav' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/bet/:matchId" element={<ProtectedRoute><BetMatch /></ProtectedRoute>} />
          <Route path="/my-bets" element={<ProtectedRoute><MyBets /></ProtectedRoute>} />
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/games" element={<GamesLobby />} />
          <Route path="/games/color" element={<ProtectedRoute><ColorGame /></ProtectedRoute>} />
          <Route path="/games/coinflip" element={<ProtectedRoute><CoinFlip /></ProtectedRoute>} />
          <Route path="/games/aviator" element={<ProtectedRoute><Aviator /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!isAdmin && !isAuthPage && <BottomNav />}
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
