import { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { Ban, DollarSign, Search, Users, X } from 'lucide-react';
import api from '../utils/api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [newBalance, setNewBalance] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to load users');
    }
  };

  const updateBalance = async (userId) => {
    const val = parseFloat(newBalance);
    if (isNaN(val) || val < 0) { showToast('Enter a valid balance'); return; }
    try {
      await api.patch(`/admin/users/${userId}/balance`, { balance: val });
      setEditingId(null);
      setNewBalance('');
      loadUsers();
      showToast('Balance updated');
    } catch (err) {
      showToast('Failed to update balance');
    }
  };

  const toggleBan = async (userId, currentlyBanned) => {
    if (!currentlyBanned && !window.confirm('Ban this user? They won\'t be able to log in or place bets.')) return;
    try {
      await api.patch(`/admin/users/${userId}/ban`);
      loadUsers();
      showToast(currentlyBanned ? 'User unbanned' : 'User banned');
    } catch (err) {
      showToast('Failed to update user');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search)
  );

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Users</h1>
          <p className="admin-page-subtitle">{users.length} registered users</p>
        </div>
        <div className="admin-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon-wrap"><Users size={32} /></div>
          <div className="empty-state-title">{search ? 'No users found' : 'No users yet'}</div>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Phone</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u._id}>
                  <td>
                    <div className="table-user">
                      <div className="table-user-avatar">{u.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{u.phone}</td>
                  <td>
                    {editingId === u._id ? (
                      <div className="inline-edit">
                        <input
                          type="number"
                          value={newBalance}
                          onChange={e => setNewBalance(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && updateBalance(u._id)}
                          autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => updateBalance(u._id)}>Save</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <span className="balance-display">{formatCurrency(u.balance)}</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-badge ${u.banned ? 'status-rejected' : 'status-approved'}`}>
                      {u.banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{formatDateTime(u.createdAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => { setEditingId(u._id); setNewBalance(String(u.balance)); }}>
                        <DollarSign size={14} /> Balance
                      </button>
                      <button
                        className={`btn btn-sm ${u.banned ? 'btn-success' : 'btn-danger'}`}
                        onClick={() => toggleBan(u._id, u.banned)}
                      >
                        <Ban size={14} /> {u.banned ? 'Unban' : 'Ban'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
