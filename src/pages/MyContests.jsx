import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Trophy, Users, ChevronRight } from 'lucide-react';
import api from '../utils/api';

export default function MyContests() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadContests(); }, []);

  const loadContests = async () => {
    try {
      const res = await api.get('/contests/my');
      setContests(res.data);
    } catch (err) {
      console.error('Failed to load contests');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="main-content"><div className="loading-spinner"><div className="spinner" /></div></div>;

  return (
    <div className="main-content">
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 24 }}>
        <Trophy size={24} style={{ color: 'var(--accent-primary)', verticalAlign: 'middle', marginRight: 8 }} />
        My Contests
      </h1>

      {contests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <div className="empty-state-title">No contests joined yet</div>
          <div className="empty-state-desc">Go to a match, create a team, and join a contest!</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
            Browse Matches
          </button>
        </div>
      ) : (
        <div className="matches-list">
          {contests.map(contest => (
            <div key={contest._id} className="match-card" style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/match/${contest.matchId?._id}`)}>
              <div className="match-card-header">
                <div className="match-league">
                  <span>🏏</span>
                  <span>{contest.matchId?.title}</span>
                </div>
                <span className={`badge ${contest.status === 'live' ? 'badge-live' : contest.status === 'open' ? 'badge-upcoming' : 'badge-completed'}`}>
                  {contest.status}
                </span>
              </div>
              <div className="match-card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{contest.name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Entry: <strong>{contest.entryFee > 0 ? formatCurrency(contest.entryFee) : 'Free'}</strong>
                    {' • '}Prize: <strong style={{ color: 'var(--accent-success)' }}>
                      {contest.prizePool > 0 ? formatCurrency(contest.prizePool) : 'Practice'}
                    </strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                    <Users size={14} style={{ verticalAlign: 'middle' }} /> {contest.teams.length} / {contest.maxTeams} teams joined
                  </div>
                </div>
                <ChevronRight size={20} color="var(--text-tertiary)" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
