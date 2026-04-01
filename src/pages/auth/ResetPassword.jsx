import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import authApi from '../../api/authApi';
import './ResetPassword.css';

const ResetPassword = () => {
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    token: params.get('token') || '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.resetPassword(form);
      toast.success(response.message || 'Password reset successful');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-card">
      <header className="auth-card__header">
        <h1>Reset Password</h1>
        <p>Enter your reset token and new password.</p>
      </header>

      <form className="auth-card__form" onSubmit={handleSubmit}>
        <label className="auth-card__label" htmlFor="reset-token">
          Reset Token
        </label>
        <input
          id="reset-token"
          className="auth-card__input"
          value={form.token}
          onChange={(e) => setForm((p) => ({ ...p, token: e.target.value }))}
          required
        />

        <label className="auth-card__label" htmlFor="new-password">
          New Password
        </label>
        <input
          id="new-password"
          type="password"
          className="auth-card__input"
          value={form.newPassword}
          onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
          required
        />

        <label className="auth-card__label" htmlFor="confirm-password">
          Confirm Password
        </label>
        <input
          id="confirm-password"
          type="password"
          className="auth-card__input"
          value={form.confirmPassword}
          onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
          required
        />

        <button type="submit" className="auth-card__submit" disabled={loading}>
          {loading ? 'Resetting...' : 'Reset password'}
        </button>
      </form>

      <div className="auth-card__footer">
        <Link to="/login">Back to login</Link>
      </div>
    </section>
  );
};

export default ResetPassword;
