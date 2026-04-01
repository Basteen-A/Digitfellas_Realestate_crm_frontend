import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clearAuthState, login } from '../../redux/slices/authSlice';
import './Login.css';

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error } = useSelector((state) => state.auth);

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearAuthState());

    const result = await dispatch(login(form));
    if (login.fulfilled.match(result)) {
      toast.success('Welcome back');
      navigate(location.state?.from?.pathname || '/', { replace: true });
      return;
    }

    toast.error(result.payload || 'Login failed');
  };

  return (
    <section className="auth-card">
      <header className="auth-card__header">
        <h1>Sign in</h1>
        <p>Access your CRM workspace</p>
      </header>

      <form className="auth-card__form" onSubmit={handleSubmit}>
        <label className="auth-card__label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          className="auth-card__input"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          required
        />

        <label className="auth-card__label" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          className="auth-card__input"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          required
        />

        {error && <p className="auth-card__error">{error}</p>}

        <button type="submit" className="auth-card__submit" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="auth-card__footer">
        <Link to="/forgot-password">Forgot password?</Link>
      </div>
    </section>
  );
};

export default Login;
