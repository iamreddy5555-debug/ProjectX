import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { Wallet, Palette, Coins, Plane, Flame, Sparkles, Dice5 } from 'lucide-react';

const GAMES = [
  {
    id: 'aviator',
    path: '/games/aviator',
    name: 'Aviator',
    tagline: 'Crash & Cash Out',
    icon: Plane,
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)',
    maxPayout: '50×',
    hot: true,
  },
  {
    id: 'color',
    path: '/games/color',
    name: 'Color & Number',
    tagline: 'Parity Prediction',
    icon: Palette,
    gradient: 'linear-gradient(135deg, #ef4444 0%, #10b981 50%, #8b5cf6 100%)',
    maxPayout: '9×',
    hot: true,
  },
  {
    id: 'ludo',
    path: '/games/ludo',
    name: 'Ludo Race',
    tagline: 'Pick a color, win 3.6×',
    icon: Dice5,
    gradient: 'linear-gradient(135deg, #ef4444 0%, #fbbf24 33%, #22c55e 66%, #3b82f6 100%)',
    maxPayout: '3.6×',
    hot: true,
  },
  {
    id: 'coinflip',
    path: '/games/coinflip',
    name: 'Coin Flip',
    tagline: 'Heads or Tails',
    icon: Coins,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    maxPayout: '2×',
  },
];

export default function GamesLobby() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="main-content casino-main">
      <div className="casino-lobby-hero">
        <div>
          <h1 className="casino-lobby-title"><Sparkles size={20} className="icon-gold" /> Instant Games</h1>
          <p className="casino-lobby-subtitle">Stake from ₹49 to ₹999. Win up to 50×.</p>
        </div>
        {user && (
          <div className="games-balance">
            <Wallet size={16} />
            <span>{formatCurrency(user.balance || 0)}</span>
          </div>
        )}
      </div>

      <div className="casino-lobby-grid">
        {GAMES.map(game => (
          <button
            key={game.id}
            className="casino-lobby-tile"
            onClick={() => user ? navigate(game.path) : navigate('/login')}
          >
            {game.hot && <span className="tile-hot-badge"><Flame size={10} /> HOT</span>}
            <div className="casino-lobby-art" style={{ background: game.gradient }}>
              <game.icon size={56} color="white" strokeWidth={2.5} />
              <span className="casino-lobby-payout">Up to {game.maxPayout}</span>
            </div>
            <div className="casino-lobby-info">
              <div className="casino-lobby-name">{game.name}</div>
              <div className="casino-lobby-tagline">{game.tagline}</div>
              <div className="casino-lobby-play">Play Now →</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
