import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';
import { ArrowLeft, Star, Shield, Users, Zap, Check, Trophy, ChevronDown } from 'lucide-react';
import api from '../utils/api';

const ROLE_ICONS = { 'wicket-keeper': '🧤', 'batsman': '🏏', 'bowler': '🎯', 'all-rounder': '⚡' };
const ROLE_LABELS = { 'wicket-keeper': 'WK', 'batsman': 'BAT', 'bowler': 'BOWL', 'all-rounder': 'AR' };
const ROLE_COLORS = { 'wicket-keeper': '#e74c3c', 'batsman': '#3498db', 'bowler': '#27ae60', 'all-rounder': '#f39c12' };
const MAX_CREDITS = 100;

export default function MatchDetail() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user, updateBalance } = useAuth();

  const [match, setMatch] = useState(null);
  const [playersData, setPlayersData] = useState(null);
  const [contests, setContests] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Team builder state
  const [step, setStep] = useState('contests'); // 'contests' | 'create-team' | 'captain'
  const [selected, setSelected] = useState([]);
  const [captain, setCaptain] = useState(null);
  const [viceCaptain, setViceCaptain] = useState(null);
  const [teamName, setTeamName] = useState('My Team');
  const [activeTab, setActiveTab] = useState('all');
  const [joinContestId, setJoinContestId] = useState(null);
  const [toast, setToast] = useState('');
  const [saving, setSaving] = useState(false);

  // Match locked = started or finished, no team creation allowed
  const matchLocked = match && (match.status === 'live' || match.status === 'completed' || new Date(match.startTime) <= new Date());

  useEffect(() => { loadAll(); }, [matchId]);

  const loadAll = async () => {
    try {
      const [matchRes, playersRes, contestsRes, teamsRes] = await Promise.all([
        api.get(`/matches/${matchId}`),
        api.get(`/players/match/${matchId}`),
        api.get(`/contests/match/${matchId}`),
        api.get(`/teams/match/${matchId}`),
      ]);
      setMatch(matchRes.data);
      setPlayersData(playersRes.data);
      setContests(contestsRes.data);
      setMyTeams(teamsRes.data);
    } catch (err) {
      console.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const allPlayers = playersData ? [...playersData.teamA.players, ...playersData.teamB.players] : [];

  const selectedPlayers = allPlayers.filter(p => selected.includes(p._id));
  const usedCredits = selectedPlayers.reduce((s, p) => s + p.credit, 0);
  const remainingCredits = MAX_CREDITS - usedCredits;

  const roleCount = (role) => selectedPlayers.filter(p => p.role === role).length;
  const teamCount = (team) => selectedPlayers.filter(p => p.team === team).length;

  const togglePlayer = (playerId) => {
    if (selected.includes(playerId)) {
      setSelected(selected.filter(id => id !== playerId));
      if (captain === playerId) setCaptain(null);
      if (viceCaptain === playerId) setViceCaptain(null);
    } else {
      if (selected.length >= 11) {
        showToast('Maximum 11 players allowed');
        return;
      }
      const player = allPlayers.find(p => p._id === playerId);
      if (!player) return;
      if (teamCount(player.team) >= 7) {
        showToast('Max 7 players from one team');
        return;
      }
      if (usedCredits + player.credit > MAX_CREDITS) {
        showToast('Not enough credits remaining');
        return;
      }
      setSelected([...selected, playerId]);
    }
  };

  const filteredPlayers = activeTab === 'all' ? allPlayers :
    activeTab === 'teamA' ? (playersData?.teamA.players || []) :
    activeTab === 'teamB' ? (playersData?.teamB.players || []) :
    allPlayers.filter(p => p.role === activeTab);

  const handleCreateTeam = async () => {
    if (selected.length !== 11) { showToast('Select exactly 11 players'); return; }
    if (!captain || !viceCaptain) { showToast('Select Captain and Vice Captain'); return; }
    
    setSaving(true);
    try {
      const res = await api.post('/teams', {
        matchId, name: teamName, players: selected, captain, viceCaptain,
      });
      setMyTeams([...myTeams, res.data]);
      showToast('Team created successfully!');
      setStep('contests');
      setSelected([]); setCaptain(null); setViceCaptain(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create team');
    } finally {
      setSaving(false);
    }
  };

  const handleJoinContest = async (contestId, teamId) => {
    try {
      const res = await api.post(`/contests/${contestId}/join`, { teamId });
      updateBalance(res.data.newBalance);
      showToast('Joined contest! 🎉');
      setJoinContestId(null);
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to join');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  if (loading) return <div className="main-content"><div className="loading-spinner"><div className="spinner" /></div></div>;
  if (!match) return <div className="main-content"><div className="empty-state"><div className="empty-state-title">Match not found</div></div></div>;

  return (
    <div className="main-content" style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button className="btn btn-icon btn-secondary" onClick={() => step === 'contests' ? navigate('/') : setStep('contests')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.5px' }}>{match.title}</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {match.league} • {formatDate(match.startTime)} • {formatTime(match.startTime)}
          </p>
        </div>
      </div>

      {/* ===== CONTESTS VIEW ===== */}
      {step === 'contests' && (
        <>
          {/* My Teams */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>My Teams ({myTeams.length})</h2>
              {!matchLocked && (
                <button className="btn btn-primary" onClick={() => setStep('create-team')}>
                  + Create Team
                </button>
              )}
            </div>
            {matchLocked && (
              <div style={{ background: 'var(--accent-warning-light)', color: 'var(--accent-warning)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 12, fontSize: '0.85rem', fontWeight: 600 }}>
                🔒 Match has started — team creation is closed
              </div>
            )}
            {myTeams.length === 0 ? (
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 24, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>No teams created yet</p>
                {!matchLocked && (
                  <button className="btn btn-primary" onClick={() => setStep('create-team')}>Create Your First Team</button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                {myTeams.map((team, i) => (
                  <div key={team._id} style={{
                    minWidth: 220, background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-lg)', padding: 16, boxShadow: 'var(--shadow-card)',
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{team.name || `Team ${i + 1}`}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <Star size={12} style={{ color: '#f59e0b' }} /> C: {team.captain?.name || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                      <Shield size={12} style={{ color: '#6366f1' }} /> VC: {team.viceCaptain?.name || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      {team.players?.length || 0} players • {team.totalCredits} credits
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contests */}
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}>
            <Trophy size={18} style={{ color: 'var(--accent-primary)' }} /> Contests
          </h2>
          <div className="matches-list">
            {contests.map(contest => {
              const spotsLeft = contest.maxTeams - contest.teams.length;
              const filled = (contest.teams.length / contest.maxTeams) * 100;
              const userJoined = contest.teams.some(t => t.userId?._id === user?.id || t.userId === user?.id);
              return (
                <div key={contest._id} className="match-card">
                  <div className="match-card-body" style={{ padding: '18px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{contest.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Prize Pool: <span style={{ fontWeight: 700, color: 'var(--accent-success)' }}>
                            {contest.prizePool > 0 ? formatCurrency(contest.prizePool) : 'Free'}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {userJoined ? (
                          <span className="status-badge status-approved">Joined ✓</span>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              if (myTeams.length === 0) { showToast('Create a team first!'); return; }
                              if (myTeams.length === 1) { handleJoinContest(contest._id, myTeams[0]._id); }
                              else { setJoinContestId(contest._id); }
                            }}
                            disabled={match.status === 'completed'}
                          >
                            {contest.entryFee > 0 ? `₹${contest.entryFee}` : 'FREE'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{
                        height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', width: `${Math.min(filled, 100)}%`, borderRadius: 3,
                          background: filled > 80 ? 'var(--accent-danger)' : 'var(--accent-primary)',
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                      <span>{spotsLeft} spots left</span>
                      <span>{contest.teams.length} / {contest.maxTeams} teams</span>
                    </div>

                    {/* Prize Breakdown */}
                    {contest.prizeBreakdown?.length > 0 && (
                      <div style={{
                        marginTop: 12, padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                        display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.8rem',
                      }}>
                        {contest.prizeBreakdown.map((p, i) => (
                          <span key={i} style={{ color: 'var(--text-secondary)' }}>
                            #{p.rank}: <strong style={{ color: 'var(--accent-success)' }}>{formatCurrency(p.prize)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ===== CREATE TEAM VIEW ===== */}
      {step === 'create-team' && (
        <>
          {/* Credits Bar */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)',
            padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 12, boxShadow: 'var(--shadow-card)',
          }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Players</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{selected.length}<span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>/11</span></div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Credits Left</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: remainingCredits < 10 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                  {remainingCredits.toFixed(1)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <div key={role} style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 700,
                  background: `${ROLE_COLORS[role]}15`, color: ROLE_COLORS[role],
                  border: `1px solid ${ROLE_COLORS[role]}30`,
                }}>
                  {ROLE_ICONS[role]} {label}: {roleCount(role)}
                </div>
              ))}
            </div>
          </div>

          {/* Team count indicator */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {playersData && [playersData.teamA.name, playersData.teamB.name].map(team => (
              <div key={team} style={{
                flex: 1, padding: '8px 14px', background: teamCount(team) >= 7 ? 'var(--accent-danger-light)' : 'var(--bg-card)',
                border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                fontSize: '0.8rem', fontWeight: 600, textAlign: 'center',
              }}>
                {team}: <strong>{teamCount(team)}</strong>/7
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-tertiary)', padding: 4, borderRadius: 'var(--radius-full)', marginBottom: 16, overflowX: 'auto' }}>
            {[
              { key: 'all', label: 'ALL' },
              { key: 'teamA', label: playersData?.teamA.name || 'Team A' },
              { key: 'teamB', label: playersData?.teamB.name || 'Team B' },
              { key: 'wicket-keeper', label: '🧤 WK' },
              { key: 'batsman', label: '🏏 BAT' },
              { key: 'bowler', label: '🎯 BOWL' },
              { key: 'all-rounder', label: '⚡ AR' },
            ].map(tab => (
              <button key={tab.key}
                className={`filter-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Players List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {filteredPlayers.map(player => {
              const isSelected = selected.includes(player._id);
              return (
                <div key={player._id}
                  onClick={() => togglePlayer(player._id)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer',
                    background: isSelected ? 'var(--accent-primary-light)' : 'var(--bg-card)',
                    border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                    borderRadius: 'var(--radius-md)', transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(79,70,229,0.12)' : 'none',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', marginRight: 14,
                    background: `${ROLE_COLORS[player.role]}20`, color: ROLE_COLORS[player.role],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem', fontWeight: 700, flexShrink: 0,
                  }}>
                    {ROLE_ICONS[player.role]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{player.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', gap: 8, marginTop: 2 }}>
                      <span>{player.team}</span>
                      <span style={{ color: ROLE_COLORS[player.role], fontWeight: 600 }}>{ROLE_LABELS[player.role]}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{player.credit}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Credits</div>
                  </div>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: isSelected ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
                    transition: 'all 0.15s ease',
                  }}>
                    {isSelected && <Check size={14} color="white" strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Continue Button */}
          <div style={{ position: 'sticky', bottom: 16, textAlign: 'center' }}>
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', maxWidth: 400, boxShadow: '0 4px 20px rgba(79,70,229,0.3)' }}
              onClick={() => {
                if (selected.length !== 11) { showToast('Select exactly 11 players'); return; }
                setStep('captain');
              }}
              disabled={selected.length !== 11}
            >
              Continue → Select Captain ({selected.length}/11)
            </button>
          </div>
        </>
      )}

      {/* ===== CAPTAIN SELECTION ===== */}
      {step === 'captain' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Choose Captain & Vice Captain</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Captain gets 2x points • Vice Captain gets 1.5x points
            </p>
          </div>

          <div className="form-group" style={{ maxWidth: 300, margin: '0 auto 20px' }}>
            <label>Team Name</label>
            <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="My Team" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {selectedPlayers.map(player => (
              <div key={player._id} style={{
                display: 'flex', alignItems: 'center', padding: '14px 18px',
                background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', marginRight: 14,
                  background: `${ROLE_COLORS[player.role]}20`, color: ROLE_COLORS[player.role],
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                }}>
                  {ROLE_ICONS[player.role]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{player.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{player.team} • {ROLE_LABELS[player.role]}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={`btn btn-sm ${captain === player._id ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => {
                      if (viceCaptain === player._id) setViceCaptain(null);
                      setCaptain(captain === player._id ? null : player._id);
                    }}
                    style={{ minWidth: 40, fontSize: '0.75rem' }}
                  >
                    <Star size={14} /> C
                  </button>
                  <button
                    className={`btn btn-sm ${viceCaptain === player._id ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => {
                      if (captain === player._id) setCaptain(null);
                      setViceCaptain(viceCaptain === player._id ? null : player._id);
                    }}
                    style={{ minWidth: 40, fontSize: '0.75rem' }}
                  >
                    <Shield size={14} /> VC
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ position: 'sticky', bottom: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-secondary btn-lg" onClick={() => setStep('create-team')}>
              ← Back
            </button>
            <button
              className="btn btn-primary btn-lg"
              style={{ boxShadow: '0 4px 20px rgba(79,70,229,0.3)' }}
              onClick={handleCreateTeam}
              disabled={!captain || !viceCaptain || saving}
            >
              {saving ? 'Creating...' : '🏏 Create Team'}
            </button>
          </div>
        </>
      )}

      {/* Team Selection Modal for joining contest */}
      {joinContestId && myTeams.length > 1 && (
        <div className="modal-overlay" onClick={() => setJoinContestId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Select Team to Join</h3>
              <button className="bet-slip-close" onClick={() => setJoinContestId(null)}>✕</button>
            </div>
            <div className="modal-body">
              {myTeams.map((team, i) => (
                <div key={team._id}
                  onClick={() => handleJoinContest(joinContestId, team._id)}
                  style={{
                    padding: 16, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                    marginBottom: 10, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-light)'}
                >
                  <div style={{ fontWeight: 700 }}>{team.name || `Team ${i + 1}`}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    C: {team.captain?.name} | VC: {team.viceCaptain?.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
