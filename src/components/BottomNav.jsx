import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Gamepad2, Target, Wallet, User } from 'lucide-react';

const ITEMS = [
  { path: '/', label: 'Matches', icon: Home },
  { path: '/games', label: 'Games', icon: Gamepad2 },
  { path: '/my-bets', label: 'My Bets', icon: Target, auth: true },
  { path: '/wallet', label: 'Wallet', icon: Wallet, auth: true },
  { path: '/profile', label: 'Profile', icon: User, auth: true },
];

export default function BottomNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const isActive = (path) =>
    path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');

  const items = user ? ITEMS : ITEMS.filter(i => !i.auth);

  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <Link
          key={item.path}
          to={user || !item.auth ? item.path : '/login'}
          className={`bottom-nav-item ${isActive(item.path) ? 'active' : ''}`}
        >
          <item.icon size={20} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
