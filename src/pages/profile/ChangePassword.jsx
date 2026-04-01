import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { changePassword } from '../../redux/slices/authSlice';

const ChangePassword = () => {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((state) => state.auth);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const result = await dispatch(changePassword(form));
    if (changePassword.fulfilled.match(result)) {
      toast.success(result.payload || 'Password changed successfully');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      return;
    }

    toast.error(result.payload || 'Unable to change password');
  };

  return (
    <section className="profile-page">
      <header>
        <h1>Change Password</h1>
        <p>Update your account password securely.</p>
      </header>

      <form className="profile-card" onSubmit={handleSubmit} style={{ padding: 14 }}>
        <label className="auth-card__label" htmlFor="current-password">
          Current Password
        </label>
        <input
          id="current-password"
          className="auth-card__input"
          type="password"
          value={form.currentPassword}
          onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
          required
        />

        <label className="auth-card__label" htmlFor="new-password-update">
          New Password
        </label>
        <input
          id="new-password-update"
          className="auth-card__input"
          type="password"
          value={form.newPassword}
          onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
          required
        />

        <label className="auth-card__label" htmlFor="confirm-password-update">
          Confirm Password
        </label>
        <input
          id="confirm-password-update"
          className="auth-card__input"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
          required
        />

        <button type="submit" className="auth-card__submit" disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </section>
  );
};

export default ChangePassword;
