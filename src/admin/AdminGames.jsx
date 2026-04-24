import { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Gamepad2, Palette, Coins, Plane, Users, TrendingUp, TrendingDown, RefreshCw, Zap } from 'lucide-react';
import api from '../utils/api';

const GAME_LABELS = {
  color:    { name: 'Color / Number', icon: Palette, color: '#a855f7' },
  coinflip: { name: 'Coin Flip',      icon: Coins,   color: '#fbbf24' },
  aviator:  { name: 'Aviator',        icon: Plane,   color: '#ef4444' },
};

export default function AdminGames() {
  const [stats, setStats] = useState(null);
  const [control, setControl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [activeGame, setActiveGame] = useState('color');
  const [colorRollInput, setColorRollInput] = useState('');
  const [aviatorCrashInput, setAviatorCrashInput] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        api.get('/admin/games/stats'),
        api.get('/admin/control'),
      ]);
      setStats(s.data);
      setControl(c.data);
    } catch (err) {
      showToast('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const setNextColorRoll = async (n, mode = 'oneshot') => {
    try {
      const res = await api.patch('/admin/control', { nextColorRoll: n, nextColorMode: mode });
      setControl(res.data);
      showToast(n === 'clear' ? 'Cleared color override' : `Next color roll will be ${n} (${mode})`);
    } catch (err) { showToast('Failed'); }
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
          <h1 className="admin-page-title">Games Control</h1>
          <p className="admin-page-subtitle">Per-game stats, top players, and rigging controls</p>
        </div>
        <button className="btn btn-outline" onClick={loadAll}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Per-game summary cards */}
      <div className="games-summary-grid">
        {Object.keys(GAME_LABELS).map(key => {
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
          <div className="control-card">
            <div className="control-head">
              <Palette size={18} style={{ color: '#a855f7' }} />
              <h3>Color & Number</h3>
            </div>
            <p className="control-desc">Force the next roll to a specific number (0-9).</p>

            <div className="control-current">
              Current override:
              {control?.nextColorRoll !== null && control?.nextColorRoll !== undefined ? (
                <span className="control-pill active">
                  {control.nextColorRoll} ({control.nextColorMode})
                </span>
              ) : (
                <span className="control-pill none">None (random)</span>
              )}
            </div>

            <div className="control-numbers">
              {[0,1,2,3,4,5,6,7,8,9].map(n => (
                <button
                  key={n}
                  className={`control-num ${control?.nextColorRoll === n ? 'selected' : ''}`}
                  onClick={() => setNextColorRoll(n)}
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

          {/* Aviator control */}
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
        </div>
      </div>

      {/* Top users per game */}
      <div className="admin-section">
        <h2 className="admin-section-title"><Users size={18} /> Top Users by Game</h2>

        <div className="top-users-tabs">
          {Object.keys(GAME_LABELS).map(key => (
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
