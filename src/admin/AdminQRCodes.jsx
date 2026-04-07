import { useState, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, X, Upload, QrCode } from 'lucide-react';
import api, { SERVER_URL } from '../utils/api';

export default function AdminQRCodes() {
  const [qrcodes, setQrcodes] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [label, setLabel] = useState('');
  const [qrFile, setQrFile] = useState(null);
  const [preview, setPreview] = useState(null);
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setQrFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const addQRCode = async () => {
    if (!upiId) { showToast('UPI ID is required'); return; }
    if (!qrFile) { showToast('QR image is required'); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('upiId', upiId);
      formData.append('label', label || 'Payment QR');
      formData.append('qrImage', qrFile);
      // Don't set Content-Type — axios will auto-set with the multipart boundary
      await api.post('/admin/qrcodes', formData);
      resetForm();
      showToast('QR Code added successfully!');
      loadQRCodes();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add QR code');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowAdd(false);
    setUpiId('');
    setLabel('');
    setQrFile(null);
    setPreview(null);
  };

  const toggleQR = async (id) => {
    try {
      await api.patch(`/admin/qrcodes/${id}/toggle`, {});
      loadQRCodes();
    } catch (err) {
      showToast('Failed to toggle');
    }
  };

  const deleteQR = async (id) => {
    if (!window.confirm('Delete this QR code? Users won\'t be able to use it for payments.')) return;
    try {
      await api.delete(`/admin/qrcodes/${id}`);
      showToast('QR Code deleted');
      loadQRCodes();
    } catch (err) {
      showToast('Failed to delete');
    }
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const activeCount = qrcodes.filter(q => q.isActive).length;

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">QR Codes</h1>
          <p className="admin-page-subtitle">{qrcodes.length} total, {activeCount} active</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={18} /> Add QR Code
        </button>
      </div>

      {qrcodes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon-wrap">
            <QrCode size={32} />
          </div>
          <div className="empty-state-title">No QR codes added</div>
          <div className="empty-state-desc">Add QR codes so users can make deposit payments</div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ marginTop: 16 }}>
            <Plus size={18} /> Add First QR Code
          </button>
        </div>
      ) : (
        <div className="qr-grid">
          {qrcodes.map(qr => (
            <div key={qr._id} className={`qr-card ${!qr.isActive ? 'inactive' : ''}`}>
              <div className="qr-card-image">
                <img src={`${SERVER_URL}${qr.imageUrl}`} alt={qr.label} />
                {!qr.isActive && <div className="qr-card-disabled-overlay">DISABLED</div>}
              </div>
              <div className="qr-card-body">
                <div className="qr-card-upi">{qr.upiId}</div>
                <div className="qr-card-label">{qr.label}</div>
                <div className="qr-card-status">
                  <span className={`status-badge ${qr.isActive ? 'status-approved' : 'status-rejected'}`}>
                    {qr.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="qr-card-actions">
                  <button
                    className={`btn btn-sm ${qr.isActive ? 'btn-outline' : 'btn-success'}`}
                    onClick={() => toggleQR(qr._id)}
                  >
                    {qr.isActive ? <><ToggleRight size={14} /> Disable</> : <><ToggleLeft size={14} /> Enable</>}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteQR(qr._id)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add QR Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">Add Payment QR Code</h3>
              <button className="modal-close" onClick={resetForm}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>UPI ID *</label>
                <input type="text" placeholder="yourname@upi" value={upiId} onChange={e => setUpiId(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Label (e.g. PhonePe, GPay, Paytm)</label>
                <input type="text" placeholder="Payment method name" value={label} onChange={e => setLabel(e.target.value)} />
              </div>
              <div className="form-group">
                <label>QR Code Image *</label>
                <label className="file-drop-zone">
                  <input type="file" accept="image/*" onChange={handleFileSelect} hidden />
                  {preview ? (
                    <img src={preview} alt="Preview" className="file-drop-preview" />
                  ) : (
                    <div className="file-drop-content">
                      <Upload size={28} />
                      <span>Click to upload QR image</span>
                      <span className="file-drop-hint">PNG, JPG up to 5MB</span>
                    </div>
                  )}
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              <button className="btn btn-primary" onClick={addQRCode} disabled={loading}>
                {loading ? 'Uploading...' : 'Add QR Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
