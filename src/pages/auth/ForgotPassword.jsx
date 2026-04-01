import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import authApi from '../../api/authApi';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await authApi.forgotPassword(email);
      toast.success(response.message || 'Reset instructions sent');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to send reset link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-card">
      <header className="auth-card__header">
        <h1>Forgot Password</h1>
        <p>We will send reset instructions to your email.</p>
      </header>

      <form className="auth-card__form" onSubmit={handleSubmit}>
        <label className="auth-card__label" htmlFor="forgot-email">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          className="auth-card__input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="auth-card__submit" disabled={loading}>
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <div className="auth-card__footer">
        <Link to="/login">Back to login</Link>
      </div>
    </section>
  );
};

export default ForgotPassword;
