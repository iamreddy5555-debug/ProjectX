import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatTime } from '../utils/formatters';
import { Trophy, Clock, Zap, ChevronRight } from 'lucide-react';
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

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMatches(); }, []);

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
  const upcomingMatches = matches.filter(m => m.status === 'upcoming' && !isSameDay(m.startTime, today)).slice(0, 6);

  return (
    <div className="main-content">
      {/* Hero Banner */}
      <div className="featured-banner">
        <h2>Predict & Win — IPL 2026</h2>
        <p>Pick the winning team. Stake from ₹49 to ₹999. Win double your money.</p>
      </div>

      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 className="section-title">
            <Zap size={20} style={{ color: 'var(--accent-danger)' }} /> Live Now
          </h2>
          <div className="matches-list">
            {liveMatches.map(match => (
              <SimpleMatchCard key={match._id} match={match} onClick={() => handleBet(match)} />
            ))}
          </div>
        </section>
      )}

      {/* Today's Matches */}
      <section style={{ marginBottom: 28 }}>
        <h2 className="section-title">
          <Trophy size={20} style={{ color: 'var(--accent-primary)' }} /> Today's Matches
        </h2>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : todayMatches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏏</div>
            <div className="empty-state-title">No matches today</div>
            <div className="empty-state-desc">Check upcoming matches below</div>
          </div>
        ) : (
          <div className="matches-list">
            {todayMatches.map(match => (
              <SimpleMatchCard key={match._id} match={match} onClick={() => handleBet(match)} />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      {upcomingMatches.length > 0 && (
        <section>
          <h2 className="section-title">
            <Clock size={20} style={{ color: 'var(--text-tertiary)' }} /> Upcoming
          </h2>
          <div className="matches-list">
            {upcomingMatches.map(match => (
              <SimpleMatchCard key={match._id} match={match} onClick={() => handleBet(match)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SimpleMatchCard({ match, onClick }) {
  const startDate = new Date(match.startTime);
  const isLive = match.status === 'live';
  const isCompleted = match.status === 'completed';

  return (
    <div className="simple-match-card" onClick={onClick}>
      <div className="smc-header">
        <span className="smc-league">{match.league}</span>
        {isLive && <span className="badge badge-live">● LIVE</span>}
        {isCompleted && <span className="badge badge-completed">Completed</span>}
        {!isLive && !isCompleted && (
          <span className="smc-time">
            <Clock size={12} /> {formatTime(match.startTime)}
          </span>
        )}
      </div>

      <div className="smc-body">
        <div className="smc-team">
          <div className="smc-team-logo" style={{ background: TEAM_COLORS[match.teamA] || '#4f46e5' }}>
            {teamInitials(match.teamA)}
          </div>
          <span className="smc-team-name">{match.teamA}</span>
        </div>
        <div className="smc-vs">VS</div>
        <div className="smc-team smc-team-right">
          <span className="smc-team-name">{match.teamB}</span>
          <div className="smc-team-logo" style={{ background: TEAM_COLORS[match.teamB] || '#06b6d4' }}>
            {teamInitials(match.teamB)}
          </div>
        </div>
      </div>

      {match.result && <div className="smc-result">{match.result}</div>}

      {!isCompleted && (
        <div className="smc-footer">
          <span className="smc-date">{startDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <button className="smc-bet-btn">
            Bet Now <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
