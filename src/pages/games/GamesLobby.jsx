import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { Wallet, ChevronRight, Palette, Coins, Plane } from 'lucide-react';

const GAMES = [
  {
    id: 'color',
    path: '/games/color',
    name: 'Color & Number',
    tagline: 'Pick a color or number 0-9',
    icon: Palette,
    gradient: 'linear-gradient(135deg, #ef4444 0%, #10b981 50%, #8b5cf6 100%)',
    maxPayout: '9×',
  },
  {
    id: 'coinflip',
    path: '/games/coinflip',
    name: 'Coin Flip',
    tagline: 'Heads or Tails — 50/50 shot',
    icon: Coins,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    maxPayout: '2×',
  },
  {
    id: 'aviator',
    path: '/games/aviator',
    name: 'Aviator',
    tagline: 'Cash out before it crashes',
    icon: Plane,
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)',
    maxPayout: '50×',
  },
];

export default function GamesLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="main-content">
      <div className="games-header">
        <div>
          <h1 className="games-title">Games</h1>
          <p className="games-subtitle">Pick a game and play instantly</p>
        </div>
        <div className="games-balance">
          <Wallet size={16} />
          <span>{formatCurrency(user?.balance || 0)}</span>
        </div>
      </div>

      <div className="games-grid">
        {GAMES.map(game => (
          <button
            key={game.id}
            className="game-tile"
            onClick={() => user ? navigate(game.path) : navigate('/login')}
          >
            <div className="game-tile-icon" style={{ background: game.gradient }}>
              <game.icon size={32} color="white" strokeWidth={2.5} />
            </div>
            <div className="game-tile-info">
              <div className="game-tile-name">{game.name}</div>
              <div className="game-tile-tagline">{game.tagline}</div>
              <div className="game-tile-payout">Max win: <strong>{game.maxPayout}</strong></div>
            </div>
            <ChevronRight size={20} className="game-tile-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}
