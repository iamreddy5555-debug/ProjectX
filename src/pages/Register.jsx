import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, User, Mail, Lock, Phone, Eye, EyeOff } from 'lucide-react';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.phone.length !== 10 || !/^\d{10}$/.test(form.phone)) {
      setError('Enter a valid 10-digit phone number');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, `+91${form.phone}`, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => {
    let value = e.target.value;
    // Only allow digits for phone
    if (field === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }
    setForm({ ...form, [field]: value });
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Left branding panel */}
        <div className="auth-brand">
          <div className="auth-brand-content">
            <div className="auth-brand-logo">CricketX</div>
            <h2 className="auth-brand-tagline">Join the Biggest Fantasy Cricket Community</h2>
            <p className="auth-brand-desc">
              Build your dream XI, compete in IPL contests, and win real prizes every match day.
            </p>
            <div className="auth-brand-features">
              <div className="auth-brand-feature">
                <span className="auth-brand-feature-icon">&#127942;</span>
                <span>Daily contests with huge prize pools</span>
              </div>
              <div className="auth-brand-feature">
                <span className="auth-brand-feature-icon">&#9889;</span>
                <span>Live match updates & real-time scoring</span>
              </div>
              <div className="auth-brand-feature">
                <span className="auth-brand-feature-icon">&#128176;</span>
                <span>Instant withdrawals to your bank</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <h1 className="auth-title">Create Account</h1>
              <p className="auth-subtitle">Start your fantasy cricket journey</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    placeholder="Your full name"
                    value={form.name}
                    onChange={update('name')}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={update('email')}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <div className="input-with-icon">
                  <Phone size={18} className="input-icon" />
                  <div className="phone-input-wrapper">
                    <span className="phone-prefix">+91</span>
                    <input
                      type="tel"
                      placeholder="98765 43210"
                      value={form.phone}
                      onChange={update('phone')}
                      className="phone-input"
                      maxLength={10}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={update('password')}
                    required
                  />
                  <button
                    type="button"
                    className="input-icon-right"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && <div className="form-error-box">{error}</div>}

              <button
                type="submit"
                className="btn btn-primary btn-lg auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-loading"><span className="spinner-small" /> Creating account...</span>
                ) : (
                  <><UserPlus size={18} /> Create Account</>
                )}
              </button>
            </form>

            <div className="auth-divider">
              <span>Already have an account?</span>
            </div>

            <Link to="/login" className="btn btn-outline btn-lg auth-submit-btn">
              Log In Instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
