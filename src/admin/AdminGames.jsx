import { useState, useEffect, useRef } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Gamepad2, Palette, Coins, Plane, Users, TrendingUp, TrendingDown, RefreshCw, Zap, Pause, Play, Dice5 } from 'lucide-react';
import api from '../utils/api';

const POLL_INTERVAL = 4000; // 4 seconds

const GAME_LABELS = {
  color:    { name: 'Color / Number', icon: Palette, color: '#a855f7' },
  coinflip: { name: 'Coin Flip',      icon: Coins,   color: '#fbbf24' },
  aviator:  { name: 'Aviator',        icon: Plane,   color: '#ef4444' },
  ludo:     { name: 'Ludo Race',      icon: Dice5,   color: '#22c55e' },
};

const LUDO_COLORS = [
  { id: 'red',    hex: '#ef4444' },
  { id: 'blue',   hex: '#3b82f6' },
  { id: 'green',  hex: '#22c55e' },
  { id: 'yellow', hex: '#fbbf24' },
];

export default function AdminGames() {
  const [stats, setStats] = useState(null);
  const [control, setControl] = useState(null);
  const [bets, setBets] = useState({ color: [], coinflip: [], aviator: [], ludo: [] });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [activeGame, setActiveGame] = useState('color');
  const [betsTab, setBetsTab] = useState('color');
  const [colorRollInput, setColorRollInput] = useState('');
  const [aviatorCrashInput, setAviatorCrashInput] = useState('');
  const [section, setSection] = useState('overview'); // overview | color | coinflip | aviator | ludo
  const [lastUpdate, setLastUpdate] = useState(null);
  const [livePaused, setLivePaused] = useState(false);
  const [pulse, setPulse] = useState(false);
  const pollRef = useRef(null);

  // Initial load + start polling
  useEffect(() => {
    loadAll(true);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Manage polling interval based on pause state + tab visibility
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (livePaused) return;

    const tick = () => {
      if (document.hidden) return; // pause when tab inactive
      loadAll(false);
    };
    pollRef.current = setInterval(tick, POLL_INTERVAL);

    // Refresh immediately when tab becomes visible again
    const onVisibility = () => { if (!document.hidden && !livePaused) loadAll(false); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [livePaused]);

  const loadAll = async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const [s, c, bColor, bCoin, bAviator, bLudo] = await Promise.all([
        api.get('/admin/games/stats'),
        api.get('/admin/control'),
        api.get('/admin/games/bets?game=color&limit=25'),
        api.get('/admin/games/bets?game=coinflip&limit=25'),
        api.get('/admin/games/bets?game=aviator&limit=25'),
        api.get('/admin/games/bets?game=ludo&limit=25'),
      ]);
      setStats(s.data);
      setControl(c.data);
      setBets({ color: bColor.data, coinflip: bCoin.data, aviator: bAviator.data, ludo: bLudo.data });
      setLastUpdate(new Date());
      if (!initial) {
        setPulse(true);
        setTimeout(() => setPulse(false), 500);
      }
    } catch (err) {
      if (initial) showToast('Failed to load');
    } finally {
      if (initial) setLoading(false);
    }
  };

  // "30s ago" style relative time
  const timeAgo = (date) => {
    if (!date) return '';
    const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (sec < 10) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  };

  // Format a bet's selection + outcome into a readable summary
  const formatBetSelection = (bet) => {
    if (bet.gameType === 'color') {
      return bet.selection;
    }
    if (bet.gameType === 'coinflip') {
      return bet.selection;
    }
    if (bet.gameType === 'aviator') {
      return `Aviator @ ${bet.multiplier?.toFixed(2) || '?'}×`;
    }
    if (bet.gameType === 'ludo') {
      return `${bet.selection}`;
    }
    return bet.selection;
  };

  const formatBetOutcome = (bet) => {
    if (bet.gameType === 'color') {
      const [num, colors] = (bet.outcome || ':').split(':');
      return `Rolled ${num} (${colors})`;
    }
    if (bet.gameType === 'coinflip') {
      return `Landed ${bet.outcome}`;
    }
    if (bet.gameType === 'aviator') {
      if (bet.outcome === 'crashed') return `Crashed @ ${bet.crashPoint?.toFixed(2)}×`;
      if (bet.outcome === 'cashout') return `Cashed @ ${bet.multiplier?.toFixed(2)}×`;
      return bet.outcome || 'pending';
    }
    if (bet.gameType === 'ludo') {
      return `${bet.outcome} won`;
    }
    return bet.outcome;
  };

  const setNextLudoWinner = async (color, mode = 'oneshot') => {
    try {
      const res = await api.patch('/admin/control', { nextLudoWinner: color, nextLudoMode: mode });
      setControl(res.data);
      showToast(color === 'clear' ? 'Cleared Ludo override' : `Next Ludo winner: ${color} (${mode})`);
    } catch (err) { showToast('Failed'); }
  };

  const setLudoDice = async (color, value) => {
    try {
      const res = await api.patch('/admin/control', { nextLudoDice: { [color]: value } });
      setControl(res.data);
      if (value === 'clear' || value === null) {
        showToast(`${color} dice → random`);
      } else {
        showToast(`${color} dice forced to ${value}`);
      }
    } catch (err) { showToast('Failed'); }
  };

  const clearAllLudoDice = async () => {
    try {
      const res = await api.patch('/admin/control', {
        nextLudoDice: { red: 'clear', blue: 'clear', green: 'clear', yellow: 'clear' },
      });
      setControl(res.data);
      showToast('All dice overrides cleared');
    } catch (err) { showToast('Failed'); }
  };

  const secondsAgo = lastUpdate ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000) : null;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const setNextColorRoll = async (n, mode = 'oneshot') => {
    try {
      const res = await api.patch('/admin/control', { nextColorRoll: n, nextColorMode: mode });
      setControl(res.data);
      showToast(n === 'clear' ? 'Cleared color override' : `Next color roll will be ${n} (${mode})`);
    } catch (err) { showToast('Failed'); }
  };

  // Force a color by picking a random number of that color
  const forceColor = (color, mode = 'oneshot') => {
    const pools = {
      red:    [2, 4, 6, 8],       // pure red
      green:  [1, 3, 7, 9],       // pure green
      violet: [0, 5],             // violet (also counts as red/green partially)
    };
    const pool = pools[color];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setNextColorRoll(pick, mode);
  };

  // Helper to describe what color a number represents
  const numberColorLabel = (n) => {
    if (n === 0) return 'Red + Violet';
    if (n === 5) return 'Green + Violet';
    if ([2,4,6,8].includes(n)) return 'Red';
    return 'Green';
  };

  const setNextAviatorCrash = async (mult, mode = 'oneshot') => {
    try {
      const res = await api.patch('/admin/control', { nextAviatorCrash: mult, nextAviatorMode: mode });
      setControl(res.data);
      showToast(mult === 'clear' ? 'Cleared aviator override' : `Next crash will be ${mult}× (${mode})`);
    } catch (err) { showToast('Failed'); }
  };

  const applyColor = () => {
    const n = parseInt(colorRollInput, 10);
    if (isNaN(n) || n < 0 || n > 9) { showToast('Enter a number 0-9'); return; }
    setNextColorRoll(n);
    setColorRollInput('');
  };

  const applyAviator = () => {
    const m = parseFloat(aviatorCrashInput);
    if (isNaN(m) || m < 1 || m > 100) { showToast('Enter a multiplier 1-100'); return; }
    setNextAviatorCrash(m);
    setAviatorCrashInput('');
  };

  if (loading || !stats) return <div className="admin-loading">Loading games...</div>;

  const summary = stats.summary || {};
  const topUsers = stats.topUsers || {};

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">
            Games Control
            <span className={`live-pill ${livePaused ? 'paused' : 'live'} ${pulse ? 'pulse' : ''}`}>
              <span className="live-pill-dot" />
              {livePaused ? 'PAUSED' : 'LIVE'}
            </span>
          </h1>
          <p className="admin-page-subtitle">
            Per-game stats, top players, and rigging controls
            {lastUpdate && (
              <span className="live-update-time"> · updated {secondsAgo}s ago</span>
            )}
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            className="btn btn-outline"
            onClick={() => setLivePaused(p => !p)}
            title={livePaused ? 'Resume auto-refresh' : 'Pause auto-refresh'}
          >
            {livePaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
          </button>
          <button className="btn btn-outline" onClick={() => loadAll(false)}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="game-section-tabs">
        <button
          className={`gst ${section === 'overview' ? 'active' : ''}`}
          onClick={() => setSection('overview')}
        >
          <Gamepad2 size={14} /> All Games
        </button>
        {Object.entries(GAME_LABELS).map(([key, g]) => {
          const Icon = g.icon;
          return (
            <button
              key={key}
              className={`gst ${section === key ? 'active' : ''}`}
              onClick={() => { setSection(key); setBetsTab(key); setActiveGame(key); }}
              style={section === key ? { color: g.color, borderColor: g.color } : {}}
            >
              <Icon size={14} /> {g.name}
            </button>
          );
        })}
      </div>

      {/* Per-game summary cards — filtered by section */}
      <div className="games-summary-grid">
        {Object.keys(GAME_LABELS)
          .filter(key => section === 'overview' || section === key)
          .map(key => {
          const g = GAME_LABELS[key];
          const s = summary[key] || { bets: 0, totalStake: 0, totalPayout: 0, housePL: 0, winRate: 0 };
          return (
            <div key={key} className="game-summary-card">
              <div className="game-summary-head">
                <div className="game-summary-icon" style={{ background: `${g.color}22`, color: g.color }}>
                  <g.icon size={20} />
                </div>
                <div className="game-summary-name">{g.name}</div>
              </div>
              <div className="game-summary-stats">
                <div className="gss-row">
                  <span>Total Bets</span>
                  <strong>{s.bets}</strong>
                </div>
                <div className="gss-row">
                  <span>Total Staked</span>
                  <strong>{formatCurrency(s.totalStake)}</strong>
                </div>
                <div className="gss-row">
                  <span>Total Paid Out</span>
                  <strong>{formatCurrency(s.totalPayout)}</strong>
                </div>
                <div className="gss-row highlight">
                  <span>House P/L</span>
                  <strong className={s.housePL >= 0 ? 'positive' : 'negative'}>
                    {s.housePL >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {formatCurrency(s.housePL)}
                  </strong>
                </div>
                <div className="gss-row">
                  <span>Win Rate</span>
                  <strong>{s.winRate}%</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rigging Controls */}
      <div className="admin-section">
        <h2 className="admin-section-title"><Zap size={18} className="icon-gold" /> Next-Round Overrides</h2>

        <div className="control-grid">
          {/* Color control */}
          {(section === 'overview' || section === 'color') && (
          <div className="control-card">
            <div className="control-head">
              <Palette size={18} style={{ color: '#a855f7' }} />
              <h3>Color & Number</h3>
            </div>
            <p className="control-desc">
              Force the next result. Pick a color (random matching number), a specific number, or both.
            </p>

            <div className="control-current">
              Current override:
              {control?.nextColorRoll !== null && control?.nextColorRoll !== undefined ? (
                <span className="control-pill active">
                  #{control.nextColorRoll} → {numberColorLabel(control.nextColorRoll)} ({control.nextColorMode})
                </span>
              ) : (
                <span className="control-pill none">None (random)</span>
              )}
            </div>

            <div className="control-subhead">Force Color</div>
            <div className="control-color-picker">
              <button
                className="control-color-btn green"
                onClick={() => forceColor('green')}
                title="Random number from {1, 3, 7, 9}"
              >
                Green<span className="ccb-hint">1·3·7·9</span>
              </button>
              <button
                className="control-color-btn violet"
                onClick={() => forceColor('violet')}
                title="Random number from {0, 5}"
              >
                Violet<span className="ccb-hint">0·5 · 4.5×</span>
              </button>
              <button
                className="control-color-btn red"
                onClick={() => forceColor('red')}
                title="Random number from {2, 4, 6, 8}"
              >
                Red<span className="ccb-hint">2·4·6·8</span>
              </button>
            </div>

            <div className="control-subhead">Force Number (exact)</div>
            <div className="control-numbers">
              {[0,1,2,3,4,5,6,7,8,9].map(n => (
                <button
                  key={n}
                  className={`control-num color-num-${numberColorLabel(n).toLowerCase().split(' ')[0]} ${control?.nextColorRoll === n ? 'selected' : ''}`}
                  onClick={() => setNextColorRoll(n)}
                  title={numberColorLabel(n)}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="control-row">
              <input
                type="number" min="0" max="9" placeholder="0-9"
                value={colorRollInput}
                onChange={e => setColorRollInput(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={applyColor}>Set (one-shot)</button>
              <button className="btn btn-outline btn-sm" onClick={() => {
                const n = parseInt(colorRollInput, 10);
                if (isNaN(n)) { showToast('Enter number'); return; }
                setNextColorRoll(n, 'persistent');
                setColorRollInput('');
              }}>Set (persistent)</button>
            </div>

            <button className="btn btn-danger btn-sm control-clear" onClick={() => setNextColorRoll('clear')}>
              Clear override
            </button>
          </div>
          )}

          {/* Aviator control */}
          {(section === 'overview' || section === 'aviator') && (
          <div className="control-card">
            <div className="control-head">
              <Plane size={18} style={{ color: '#ef4444' }} />
              <h3>Aviator Crash</h3>
            </div>
            <p className="control-desc">Force the next plane to crash at a specific multiplier.</p>

            <div className="control-current">
              Current override:
              {control?.nextAviatorCrash !== null && control?.nextAviatorCrash !== undefined ? (
                <span className="control-pill active">
                  {control.nextAviatorCrash}× ({control.nextAviatorMode})
                </span>
              ) : (
                <span className="control-pill none">None (random)</span>
              )}
            </div>

            <div className="control-presets">
              {[1.01, 1.2, 1.5, 2, 3, 5, 10, 20, 50].map(m => (
                <button
                  key={m}
                  className={`control-num ${control?.nextAviatorCrash === m ? 'selected' : ''}`}
                  onClick={() => setNextAviatorCrash(m)}
                >{m}×</button>
              ))}
            </div>

            <div className="control-row">
              <input
                type="number" min="1.01" max="100" step="0.01" placeholder="1.01 - 100"
                value={aviatorCrashInput}
                onChange={e => setAviatorCrashInput(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={applyAviator}>Set (one-shot)</button>
              <button className="btn btn-outline btn-sm" onClick={() => {
                const m = parseFloat(aviatorCrashInput);
                if (isNaN(m)) { showToast('Enter number'); return; }
                setNextAviatorCrash(m, 'persistent');
                setAviatorCrashInput('');
              }}>Set (persistent)</button>
            </div>

            <button className="btn btn-danger btn-sm control-clear" onClick={() => setNextAviatorCrash('clear')}>
              Clear override
            </button>
          </div>
          )}

          {/* Ludo control — winner + dice */}
          {(section === 'overview' || section === 'ludo') && (
          <div className="control-card">
            <div className="control-head">
              <Dice5 size={18} style={{ color: '#22c55e' }} />
              <h3>Ludo Race</h3>
            </div>
            <p className="control-desc">Force the winner AND/OR each color's dice value.</p>

            <div className="control-current">
              Current override:
              {control?.nextLudoWinner ? (
                <span className="control-pill active" style={{ textTransform: 'capitalize' }}>
                  {control.nextLudoWinner} wins ({control.nextLudoMode})
                </span>
              ) : (
                <span className="control-pill none">None (random)</span>
              )}
            </div>

            <div className="control-subhead">Force Winner</div>
            <div className="control-color-picker">
              {LUDO_COLORS.map(c => (
                <button
                  key={c.id}
                  className={`control-color-btn ${control?.nextLudoWinner === c.id ? 'selected' : ''}`}
                  style={{ background: c.hex, textTransform: 'capitalize' }}
                  onClick={() => setNextLudoWinner(c.id)}
                >
                  {c.id}
                </button>
              ))}
            </div>

            <div className="control-row">
              {LUDO_COLORS.map(c => (
                <button
                  key={c.id}
                  className="btn btn-outline btn-sm"
                  style={{ textTransform: 'capitalize', flex: 1, minWidth: 0 }}
                  onClick={() => setNextLudoWinner(c.id, 'persistent')}
                >
                  {c.id} persistent
                </button>
              ))}
            </div>

            <button className="btn btn-danger btn-sm control-clear" onClick={() => setNextLudoWinner('clear')}>
              Clear winner override
            </button>

            {/* Dice Control — per-color forced dice value */}
            <div className="dice-control">
              <div className="control-subhead" style={{ marginTop: 14 }}>
                <Dice5 size={12} style={{ verticalAlign: '-2px' }} /> Dice Control (per color)
              </div>
              <p className="control-desc" style={{ marginTop: 0 }}>
                Force a fixed dice value for each pawn. Higher number = faster = more likely to win.
                Empty = random.
              </p>

              {LUDO_COLORS.map(c => {
                const current = control?.nextLudoDice?.[c.id];
                return (
                  <div key={c.id} className="dice-row">
                    <span className="dice-row-label" style={{ color: c.hex }}>
                      <span className="dice-row-dot" style={{ background: c.hex }} />
                      {c.id}
                    </span>
                    <div className="dice-chips">
                      {[1,2,3,4,5,6].map(v => (
                        <button
                          key={v}
                          className={`dice-chip ${current === v ? 'selected' : ''}`}
                          onClick={() => setLudoDice(c.id, v)}
                        >
                          {v}
                        </button>
                      ))}
                      <button
                        className={`dice-chip random ${!current ? 'selected' : ''}`}
                        onClick={() => setLudoDice(c.id, 'clear')}
                        title="Random (1-6)"
                      >
                        ?
                      </button>
                    </div>
                  </div>
                );
              })}

              <button className="btn btn-danger btn-sm control-clear" onClick={clearAllLudoDice}>
                Clear all dice overrides
              </button>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Live bets feed per game */}
      <div className="admin-section">
        <h2 className="admin-section-title">
          <span className="live-pill-dot" style={{ color: '#22c55e' }} />
          Live Bets Feed
        </h2>

        <div className="top-users-tabs">
          {Object.keys(GAME_LABELS)
            .filter(key => section === 'overview' || section === key)
            .map(key => {
              const count = bets[key]?.length || 0;
              return (
                <button
                  key={key}
                  className={`top-tab ${betsTab === key ? 'active' : ''}`}
                  onClick={() => setBetsTab(key)}
                >
                  {GAME_LABELS[key].name}
                  <span className="top-tab-count">{count}</span>
                </button>
              );
            })}
        </div>

        <div className="admin-table-wrap">
          <table className="data-table live-bets-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Bet</th>
                <th>Stake</th>
                <th>Outcome</th>
                <th>Result</th>
                <th>Payout</th>
              </tr>
            </thead>
            <tbody>
              {(bets[betsTab] || []).length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 24 }}>
                  No bets yet on this game
                </td></tr>
              ) : (
                (bets[betsTab] || []).map((bet) => (
                  <tr key={bet._id} className={bet.won ? 'bet-won' : bet.status === 'pending' ? 'bet-pending' : 'bet-lost'}>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {timeAgo(bet.createdAt)}
                    </td>
                    <td>
                      <div className="table-user">
                        <div className="table-user-avatar">{bet.userId?.name?.charAt(0)?.toUpperCase() || '?'}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{bet.userId?.name || 'Unknown'}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{bet.userId?.phone || bet.userId?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>{formatBetSelection(bet)}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(bet.stake)}</td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {bet.status === 'pending' ? <span className="bet-pending-badge">Pending</span> : formatBetOutcome(bet)}
                    </td>
                    <td>
                      {bet.status === 'pending' ? (
                        <span className="status-badge status-pending">Flying</span>
                      ) : bet.won ? (
                        <span className="status-badge status-won">Won</span>
                      ) : (
                        <span className="status-badge status-lost">Lost</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: bet.won ? 'var(--accent-success)' : 'var(--text-tertiary)' }}>
                      {bet.payout > 0 ? `+${formatCurrency(bet.payout)}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top users per game */}
      <div className="admin-section">
        <h2 className="admin-section-title"><Users size={18} /> Top Users by Game</h2>

        <div className="top-users-tabs">
          {Object.keys(GAME_LABELS)
            .filter(key => section === 'overview' || section === key)
            .map(key => (
              <button
                key={key}
                className={`top-tab ${activeGame === key ? 'active' : ''}`}
                onClick={() => setActiveGame(key)}
              >
                {GAME_LABELS[key].name}
              </button>
            ))}
        </div>

        <div className="admin-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Phone</th>
                <th>Bets</th>
                <th>Total Staked</th>
                <th>Total Won</th>
                <th>House P/L</th>
              </tr>
            </thead>
            <tbody>
              {(topUsers[activeGame] || []).length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 24 }}>
                  No bets yet
                </td></tr>
              ) : (
                (topUsers[activeGame] || []).map((u, i) => (
                  <tr key={u.userId}>
                    <td>{i + 1}</td>
                    <td>
                      <div className="table-user">
                        <div className="table-user-avatar">{u.name?.charAt(0)?.toUpperCase() || '?'}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{u.phone || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{u.bets}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(u.totalStake)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{formatCurrency(u.totalPayout)}</td>
                    <td style={{ fontWeight: 700, color: u.housePL >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {formatCurrency(u.housePL)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
