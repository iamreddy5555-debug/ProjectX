import { useState, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../utils/api';

export default function AdminQRCodes() {
  const [qrcodes, setQrcodes] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [label, setLabel] = useState('');
  const [qrFile, setQrFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { loadQRCodes(); }, []);

  const loadQRCodes = async () => {
    try {
      const res = await api.get('/admin/qrcodes');
      setQrcodes(res.data);
    } catch (err) {
      console.error('Failed to load QR codes');
    }
  };

  const addQRCode = async () => {
    if (!upiId || !qrFile) {
      showToast('UPI ID and QR image are required');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('upiId', upiId);
      formData.append('label', label || 'Payment QR');
      formData.append('qrImage', qrFile);
      await api.post('/admin/qrcodes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setShowAdd(false);
      setUpiId('');
      setLabel('');
      setQrFile(null);
      showToast('QR Code added!');
      loadQRCodes();
    } catch (err) {
      showToast('Failed to add QR code');
    } finally {
      setLoading(false);
    }
  };

  const toggleQR = async (id) => {
    try {
      await api.patch(`/admin/qrcodes/${id}/toggle`);
      loadQRCodes();
    } catch (err) {
      showToast('Failed to toggle');
    }
  };

  const deleteQR = async (id) => {
    if (!window.confirm('Delete this QR code?')) return;
    try {
      await api.delete(`/admin/qrcodes/${id}`);
      showToast('QR Code deleted');
      loadQRCodes();
    } catch (err) {
      showToast('Failed to delete');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="admin-page-title" style={{ marginBottom: 0 }}>📱 QR Codes ({qrcodes.length})</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={18} /> Add QR Code
        </button>
      </div>

      {qrcodes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📱</div>
          <div className="empty-state-title">No QR codes added</div>
          <div className="empty-state-desc">Add QR codes so users can make payments</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {qrcodes.map(qr => (
            <div key={qr._id} className="stat-card" style={{ textAlign: 'center' }}>
              <img
                src={`http://localhost:5000${qr.imageUrl}`}
                alt={qr.label}
                style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 12, margin: '0 auto 12px', border: '1px solid var(--border-light)' }}
              />
              <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>{qr.upiId}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{qr.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className={`status-badge ${qr.isActive ? 'status-approved' : 'status-rejected'}`}>
                  {qr.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center' }}>
                <button className="btn btn-outline btn-sm" onClick={() => toggleQR(qr._id)}>
                  {qr.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  {qr.isActive ? 'Disable' : 'Enable'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteQR(qr._id)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add QR Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add QR Code</h3>
              <button className="bet-slip-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>UPI ID *</label>
                <input type="text" placeholder="example@upi" value={upiId} onChange={e => setUpiId(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Label</label>
                <input type="text" placeholder="e.g. PhonePe, GPay" value={label} onChange={e => setLabel(e.target.value)} />
              </div>
              <div className="form-group">
                <label>QR Code Image *</label>
                <div className="file-upload">
                  <input type="file" accept="image/*" onChange={e => setQrFile(e.target.files[0])} />
                  <div className="file-upload-icon">📸</div>
                  <div className="file-upload-label">{qrFile ? qrFile.name : 'Click to upload QR image'}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addQRCode} disabled={loading}>
                {loading ? 'Adding...' : 'Add QR Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">✅ {toast}</div>}
    </div>
  );
}
