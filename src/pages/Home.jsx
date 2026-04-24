import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatTime } from '../utils/formatters';
import { Trophy, Clock, Zap, ChevronRight, Palette, Coins, Plane, Flame, Sparkles, Star } from 'lucide-react';
import api from '../utils/api';

const TEAM_COLORS = {
  'Mumbai Indians': '#004BA0',
  'Chennai Super Kings': '#FFCC00',
  'Royal Challengers Bengaluru': '#D4213D',
  'Delhi Capitals': '#004C93',
  'Kolkata Knight Riders': '#3A225D',
  'Gujarat Titans': '#1C1C2B',
  'Rajasthan Royals': '#EA1A85',
  'Punjab Kings': '#ED1B24',
  'Sunrisers Hyderabad': '#FF822A',
  'Lucknow Super Giants': '#004F91',
};

const teamInitials = (name) => {
  if (!name) return '?';
  const words = name.split(' ');
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
};

const isSameDay = (a, b) => {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

const BANNERS = [
  { title: 'Welcome Bonus 100%', subtitle: 'Deposit today and double up', gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #dc2626 100%)', emoji: '🎁' },
  { title: 'IPL 2026 Live', subtitle: 'Win up to 5× on match predictions', gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)', emoji: '🏏' },
  { title: 'Aviator Crash Game', subtitle: 'Fly high. Cash out before it crashes.', gradient: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 50%, #ef4444 100%)', emoji: '✈️' },
  { title: 'Daily Lucky Number', subtitle: 'Spin the color wheel — 9× payout', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #0891b2 100%)', emoji: '🎲' },
];

const GAME_TILES = [
  { name: 'Aviator', tagline: 'Crash game', icon: Plane, path: '/games/aviator', gradient: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)', hot: true },
  { name: 'Color & Number', tagline: 'Parity style', icon: Palette, path: '/games/color', gradient: 'linear-gradient(135deg, #ef4444 0%, #10b981 50%, #8b5cf6 100%)', hot: true },
  { name: 'Coin Flip', tagline: '50/50 shot', icon: Coins, path: '/games/coinflip', gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' },
  { name: 'Cricket Bets', tagline: 'Match winner', icon: Trophy, path: '/', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [category, setCategory] = useState('today');
  const bannerTimer = useRef(null);

  useEffect(() => { loadMatches(); }, []);

  useEffect(() => {
    bannerTimer.current = setInterval(() => setBannerIdx(i => (i + 1) % BANNERS.length), 4500);
    return () => clearInterval(bannerTimer.current);
  }, []);

  const loadMatches = async () => {
    try {
      const res = await api.get('/matches');
      setMatches(res.data);
    } catch (err) {
      console.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const handleBet = (match) => {
    if (!user) { navigate('/login'); return; }
    navigate(`/bet/${match._id}`);
  };

  const today = new Date();
  const todayMatches = matches.filter(m => isSameDay(m.startTime, today));
  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming' && !isSameDay(m.startTime, today)).slice(0, 10);

  const visibleMatches = category === 'live' ? liveMatches
    : category === 'upcoming' ? upcomingMatches
    : [...liveMatches, ...todayMatches];

  return (
    <div className="main-content casino-main">
      {/* Hero Banner Carousel */}
      <div className="banner-carousel">
        {BANNERS.map((b, i) => (
          <div
            key={i}
            className={`banner-slide ${bannerIdx === i ? 'active' : ''}`}
            style={{ background: b.gradient }}
          >
            <div className="banner-content">
              <div className="banner-emoji">{b.emoji}</div>
              <div>
                <h2 className="banner-title">{b.title}</h2>
                <p className="banner-subtitle">{b.subtitle}</p>
              </div>
            </div>
            <div className="banner-shine" />
          </div>
        ))}
        <div className="banner-dots">
          {BANNERS.map((_, i) => (
            <button
              key={i}
              className={`banner-dot ${bannerIdx === i ? 'active' : ''}`}
              onClick={() => setBannerIdx(i)}
            />
          ))}
        </div>
      </div>

      {/* Quick Games Row */}
      <section className="casino-section">
        <div className="casino-section-header">
          <h2 className="casino-section-title"><Flame size={18} className="icon-flame" /> Popular Games</h2>
          <button className="casino-section-link" onClick={() => navigate('/games')}>See All <ChevronRight size={14} /></button>
        </div>
        <div className="casino-game-row">
          {GAME_TILES.map(g => (
            <button key={g.name} className="casino-game-tile" onClick={() => navigate(g.path)}>
              {g.hot && <span className="tile-hot-badge"><Flame size={10} /> HOT</span>}
              <div className="casino-game-art" style={{ background: g.gradient }}>
                <g.icon size={36} color="white" strokeWidth={2.5} />
              </div>
              <div className="casino-game-name">{g.name}</div>
              <div className="casino-game-tag">{g.tagline}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Cricket Matches */}
      <section className="casino-section">
        <div className="casino-section-header">
          <h2 className="casino-section-title"><Trophy size={18} className="icon-gold" /> Cricket — Match Winner</h2>
        </div>

        <div className="category-tabs">
          <button className={`cat-tab ${category === 'today' ? 'active' : ''}`} onClick={() => setCategory('today')}>
            <Star size={12} /> Today
            {todayMatches.length + liveMatches.length > 0 && <span className="cat-count">{todayMatches.length + liveMatches.length}</span>}
          </button>
          <button className={`cat-tab ${category === 'live' ? 'active' : ''}`} onClick={() => setCategory('live')}>
            <span className="live-dot" /> Live
            {liveMatches.length > 0 && <span className="cat-count">{liveMatches.length}</span>}
          </button>
          <button className={`cat-tab ${category === 'upcoming' ? 'active' : ''}`} onClick={() => setCategory('upcoming')}>
            <Clock size={12} /> Upcoming
          </button>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : visibleMatches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏏</div>
            <div className="empty-state-title">No matches {category === 'live' ? 'live right now' : category === 'today' ? 'today' : 'upcoming'}</div>
          </div>
        ) : (
          <div className="casino-match-list">
            {visibleMatches.map(match => (
              <CasinoMatchCard key={match._id} match={match} onClick={() => handleBet(match)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CasinoMatchCard({ match, onClick }) {
  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';

  return (
    <div className="casino-match-card" onClick={onClick}>
      <div className="cmc-top">
        <span className="cmc-league">{match.league}</span>
        {isLive ? (
          <span className="cmc-live-badge"><span className="live-dot" /> LIVE</span>
        ) : (
          <span className="cmc-time"><Clock size={11} /> {formatTime(match.startTime)}</span>
        )}
      </div>

      <div className="cmc-teams">
        <div className="cmc-team">
          <div className="cmc-team-logo" style={{ background: TEAM_COLORS[match.teamA] || '#fbbf24' }}>
            {teamInitials(match.teamA)}
          </div>
          <div className="cmc-team-name">{match.teamA}</div>
        </div>
        <div className="cmc-vs">VS</div>
        <div className="cmc-team">
          <div className="cmc-team-logo" style={{ background: TEAM_COLORS[match.teamB] || '#ef4444' }}>
            {teamInitials(match.teamB)}
          </div>
          <div className="cmc-team-name">{match.teamB}</div>
        </div>
      </div>

      {match.result && <div className="cmc-result">{match.result}</div>}

      {!isCompleted && (
        <div className="cmc-cta">
          <div className="cmc-cta-label">
            <Sparkles size={12} /> Win up to <strong>{match.winMultiplier ?? 2}×</strong>
          </div>
          <button className="cmc-bet-btn">
            Bet Now <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
