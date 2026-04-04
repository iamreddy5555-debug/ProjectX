import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatTime } from '../utils/formatters';
import { Trophy, Clock, ChevronRight, Zap } from 'lucide-react';
import api from '../utils/api';

export default function Home() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleMatchClick = (match) => {
    if (!user) {
      navigate('/login');
      return;
    }
    navigate(`/match/${match._id}`);
  };

  const getTimeLeft = (startTime) => {
    const diff = new Date(startTime) - new Date();
    if (diff <= 0) return 'Started';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    return `${h}h ${m}m`;
  };

  const liveMatches = matches.filter(m => m.status === 'live');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');
  const completedMatches = matches.filter(m => m.status === 'completed');

  return (
    <div className="main-content">
      {/* Hero Banner */}
      <div className="featured-banner">
        <h2>🏏 IPL 2026 Fantasy Cricket</h2>
        <p>Pick your dream team, join contests & win big prizes!</p>
      </div>

      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={20} style={{ color: 'var(--accent-danger)' }} /> Live Now
          </h2>
          <div className="matches-list">
            {liveMatches.map(match => (
              <MatchItem key={match._id} match={match} onClick={() => handleMatchClick(match)} getTimeLeft={getTimeLeft} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Matches */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trophy size={20} style={{ color: 'var(--accent-primary)' }} /> Upcoming Matches
        </h2>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : upcomingMatches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏏</div>
            <div className="empty-state-title">No upcoming matches</div>
          </div>
        ) : (
          <div className="matches-list">
            {upcomingMatches.map(match => (
              <MatchItem key={match._id} match={match} onClick={() => handleMatchClick(match)} getTimeLeft={getTimeLeft} />
            ))}
          </div>
        )}
      </section>

      {/* Completed */}
      {completedMatches.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 14, color: 'var(--text-tertiary)' }}>
            Completed
          </h2>
          <div className="matches-list">
            {completedMatches.map(match => (
              <MatchItem key={match._id} match={match} onClick={() => handleMatchClick(match)} getTimeLeft={getTimeLeft} completed />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MatchItem({ match, onClick, getTimeLeft, completed }) {
  const teamInitials = (name) => {
    const words = name.split(' ');
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
  };

  const teamColors = {
    'Mumbai Indians': '#004BA0',
    'Chennai Super Kings': '#FFCC00',
    'Royal Challengers': '#D4213D',
    'Delhi Capitals': '#004C93',
    'Kolkata Knight Riders': '#3A225D',
    'Gujarat Titans': '#1C1C2B',
    'Rajasthan Royals': '#EA1A85',
    'Punjab Kings': '#ED1B24',
    'Sunrisers Hyderabad': '#FF822A',
    'Lucknow Super Giants': '#004F91',
  };

  return (
    <div className="match-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="match-card-header">
        <div className="match-league">
          <span>🏏</span>
          <span>{match.league}</span>
        </div>
        <div className="match-badges">
          {match.status === 'live' && <span className="badge badge-live">● LIVE</span>}
          {match.status === 'upcoming' && (
            <span className="badge badge-upcoming" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} /> {getTimeLeft(match.startTime)}
            </span>
          )}
          {match.status === 'completed' && <span className="badge badge-completed">Completed</span>}
        </div>
      </div>
      <div className="match-card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          {/* Team A */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: teamColors[match.teamA] || 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: match.teamA === 'Chennai Super Kings' ? '#000' : '#fff',
              fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px',
              flexShrink: 0,
            }}>
              {teamInitials(match.teamA)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{match.teamA}</div>
              {match.scoreA && <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{match.scoreA}</div>}
            </div>
          </div>

          {/* VS */}
          <div style={{
            margin: '0 20px', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-tertiary)',
            background: 'var(--bg-tertiary)', width: 36, height: 36, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>VS</div>

          {/* Team B */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, justifyContent: 'flex-end', textAlign: 'right' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{match.teamB}</div>
              {match.scoreB && <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{match.scoreB}</div>}
            </div>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: teamColors[match.teamB] || 'var(--accent-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: match.teamB === 'Chennai Super Kings' ? '#000' : '#fff',
              fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.5px',
              flexShrink: 0,
            }}>
              {teamInitials(match.teamB)}
            </div>
          </div>
        </div>

        {!completed && (
          <div style={{ marginLeft: 16 }}>
            <ChevronRight size={22} color="var(--text-tertiary)" />
          </div>
        )}
      </div>
      {match.result && <div className="match-result">{match.result}</div>}
      {!completed && (
        <div style={{
          padding: '10px 24px', borderTop: '1px solid var(--border-light)',
          fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {formatDate(match.startTime)} • {formatTime(match.startTime)}
        </div>
      )}
    </div>
  );
}
