import { useState, useEffect } from 'react';
import { formatCurrency } from '../utils/formatters';
import { Plus, Trash2, Users, X, Trophy } from 'lucide-react';
import api from '../utils/api';

export default function AdminContests() {
  const [contests, setContests] = useState([]);
  const [matches, setMatches] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    matchId: '', name: '', entryFee: 0, prizePool: 0, maxTeams: 100,
  });

  useEffect(() => {
    loadContests();
    loadMatches();
  }, []);

  const loadContests = async () => {
    try { const res = await api.get('/admin/contests'); setContests(res.data); } catch (err) { console.error(err); }
  };

  const loadMatches = async () => {
    try { const res = await api.get('/admin/matches'); setMatches(res.data); } catch (err) { console.error(err); }
  };

  const addContest = async () => {
    if (!form.matchId || !form.name) { showToast('Match and contest name are required'); return; }
    try {
      await api.post('/admin/contests', form);
      setShowAdd(false);
      setForm({ matchId: '', name: '', entryFee: 0, prizePool: 0, maxTeams: 100 });
      showToast('Contest created!');
      loadContests();
    } catch (err) {
      showToast('Failed to create contest');
    }
  };

  const deleteContest = async (id) => {
    if (!window.confirm('Delete this contest?')) return;
    try { await api.delete(`/admin/contests/${id}`); showToast('Contest deleted'); loadContests(); } catch (err) { showToast('Failed'); }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Contests</h1>
          <p className="admin-page-subtitle">{contests.length} total contests</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={18} /> Add Contest
        </button>
      </div>

      {contests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon-wrap"><Trophy size={32} /></div>
          <div className="empty-state-title">No contests yet</div>
          <div className="empty-state-desc">Create contests for matches so users can compete</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Match</th>
                <th>Contest</th>
                <th>Entry Fee</th>
                <th>Prize Pool</th>
                <th>Teams</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contests.map(c => (
                <tr key={c._id}>
                  <td style={{ fontSize: '0.85rem' }}>{c.matchId?.title || 'N/A'}</td>
                  <td style={{ fontWeight: 700 }}>{c.name}</td>
                  <td>{c.entryFee > 0 ? formatCurrency(c.entryFee) : <span className="free-badge">FREE</span>}</td>
                  <td style={{ fontWeight: 700, color: 'var(--accent-success)' }}>{formatCurrency(c.prizePool)}</td>
                  <td>
                    <span className="teams-count"><Users size={14} /> {c.teams?.length || 0}/{c.maxTeams}</span>
                  </td>
                  <td>
                    <span className={`status-badge ${c.status === 'open' ? 'status-approved' : c.status === 'live' ? 'status-pending' : 'status-rejected'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteContest(c._id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Contest Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create Contest</h3>
              <button className="modal-close" onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Match *</label>
                <select value={form.matchId} onChange={e => setForm({ ...form, matchId: e.target.value })} className="form-select">
                  <option value="">Select a match</option>
                  {matches.filter(m => m.status !== 'completed').map(m => (
                    <option key={m._id} value={m._id}>{m.teamA} vs {m.teamB}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Contest Name *</label>
                <input type="text" placeholder="e.g. Mega Contest" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Entry Fee</label>
                  <input type="number" value={form.entryFee} onChange={e => setForm({ ...form, entryFee: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Prize Pool</label>
                  <input type="number" value={form.prizePool} onChange={e => setForm({ ...form, prizePool: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Max Teams</label>
                  <input type="number" value={form.maxTeams} onChange={e => setForm({ ...form, maxTeams: parseInt(e.target.value) || 100 })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addContest}>Create Contest</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
