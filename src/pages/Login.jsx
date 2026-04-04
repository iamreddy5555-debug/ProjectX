import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Left branding panel */}
        <div className="auth-brand">
          <div className="auth-brand-content">
            <div className="auth-brand-logo">CricketX</div>
            <h2 className="auth-brand-tagline">Your Ultimate Fantasy Cricket Platform</h2>
            <p className="auth-brand-desc">
              Create teams, join contests, and win big with live IPL action.
            </p>
            <div className="auth-brand-stats">
              <div className="auth-brand-stat">
                <span className="auth-brand-stat-num">10K+</span>
                <span className="auth-brand-stat-label">Active Players</span>
              </div>
              <div className="auth-brand-stat">
                <span className="auth-brand-stat-num">50L+</span>
                <span className="auth-brand-stat-label">Prizes Won</span>
              </div>
              <div className="auth-brand-stat">
                <span className="auth-brand-stat-num">100+</span>
                <span className="auth-brand-stat-label">Daily Contests</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-card-header">
              <h1 className="auth-title">Welcome Back</h1>
              <p className="auth-subtitle">Log in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-with-icon">
                  <Lock size={18} className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
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
                  <span className="btn-loading"><span className="spinner-small" /> Logging in...</span>
                ) : (
                  <><LogIn size={18} /> Log In</>
                )}
              </button>
            </form>

            <div className="auth-divider">
              <span>New to CricketX?</span>
            </div>

            <Link to="/register" className="btn btn-outline btn-lg auth-submit-btn">
              Create an Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
