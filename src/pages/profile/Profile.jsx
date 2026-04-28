import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import authApi from '../../api/authApi';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import './Profile.css';

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: cachedUser } = useSelector((state) => state.auth);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const resp = await authApi.getProfile();
        setProfile(resp.data || cachedUser);
      } catch {
        setProfile(cachedUser);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [cachedUser]);

  const user = profile || cachedUser;
  const fullName = user?.full_name || user?.fullName || `${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`.trim() || 'User';
  const initials = `${(user?.first_name || user?.firstName || '')[0] || ''}${(user?.last_name || user?.lastName || '')[0] || ''}`.toUpperCase() || 'U';
  const roleLabel = user?.userType?.type_name || user?.userType || 'N/A';
  const roleCode = user?.userType?.short_code || user?.userTypeCode || '';
  const email = user?.email || '-';
  const phone = user?.phone || '-';
  const joinedDate = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
  const lastLogin = user?.last_login_at ? new Date(user.last_login_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  const roleColors = {
    TC: { bg: 'var(--accent-blue-bg)', color: 'var(--accent-blue)' },
    SM: { bg: 'var(--accent-green-bg)', color: 'var(--accent-green)' },
    SH: { bg: 'var(--accent-purple-bg)', color: 'var(--accent-purple)' },
    SA: { bg: 'var(--accent-orange-bg)', color: 'var(--accent-orange)' },
    ADM: { bg: 'var(--accent-orange-bg)', color: 'var(--accent-orange)' },
    COL: { bg: 'var(--accent-cyan-bg)', color: 'var(--accent-cyan)' },
  };

  const rc = roleColors[roleCode] || roleColors.TC;
  const changePasswordPath = location.pathname.startsWith('/portal/')
    ? '/portal/profile/change-password'
    : '/profile/change-password';

  if (loading) {
    return (
      <section className="profile-page">
        <div className="profile-loading">
          <div className="profile-loading-spinner" />
          <p>Loading profile...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="profile-page">
      <header className="profile-page__header">
        <h1>My Profile</h1>
        <p>Manage your account details and preferences</p>
      </header>

      <div className="profile-hero">
        <div className="profile-hero__avatar" style={{ background: rc.bg, color: rc.color }}>
          {initials}
        </div>
        <div className="profile-hero__info">
          <h2>{fullName}</h2>
          <div className="profile-hero__meta">
            <span className="profile-role-badge" style={{ background: rc.bg, color: rc.color }}>
              {roleLabel}
            </span>
            <span className="profile-hero__email">{email}</span>
          </div>
        </div>
        <div className="profile-hero__actions">
          <button
            type="button"
            className="crm-btn crm-btn-ghost"
            onClick={() => navigate(changePasswordPath)}
          >
            <LockClosedIcon style={{ width: 16, height: 16, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Change Password
          </button>
        </div>
      </div>

      <div className="profile-grid">
        <div className="profile-card">
          <div className="profile-card__title">Personal Details</div>
          <div className="profile-card__rows">
            <div className="profile-field">
              <span className="profile-field__label">Full Name</span>
              <span className="profile-field__value">{fullName}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field__label">Email Address</span>
              <span className="profile-field__value">{email}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field__label">Phone</span>
              <span className="profile-field__value">{phone}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field__label">Employee Code</span>
              <span className="profile-field__value">{user?.employee_code || '-'}</span>
            </div>
            {roleCode === 'SA' && (
              <div className="profile-field">
                <span className="profile-field__label">My Password</span>
                <span className="profile-field__value" style={{ 
                  color: user?.password_plain ? '#166534' : '#6b7280', 
                  fontWeight: user?.password_plain ? '700' : '400',
                  fontSize: user?.password_plain ? 'inherit' : '12px'
                }}>
                  {user?.password_plain || 'Log out & log back in to see your password'}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-card__title">Role & Access</div>
          <div className="profile-card__rows">
            <div className="profile-field">
              <span className="profile-field__label">User Type</span>
              <span className="profile-field__value">
                <span className="profile-role-badge" style={{ background: rc.bg, color: rc.color }}>
                  {roleLabel}
                </span>
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-field__label">Role Code</span>
              <span className="profile-field__value">{roleCode || '-'}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field__label">Reporting To</span>
              <span className="profile-field__value">
                {user?.manager ? `${user.manager.first_name || ''} ${user.manager.last_name || ''}`.trim() : '-'}
              </span>
            </div>
            <div className="profile-field">
              <span className="profile-field__label">Status</span>
              <span className="profile-field__value">
                <span className="profile-status-badge profile-status-badge--active">
                  Active
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-card__title">Account Activity</div>
          <div className="profile-card__rows">
            <div className="profile-field">
              <span className="profile-field__label">Member Since</span>
              <span className="profile-field__value">{joinedDate}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field__label">Last Login</span>
              <span className="profile-field__value">{lastLogin}</span>
            </div>
            <div className="profile-field">
              <span className="profile-field__label">Login Count</span>
              <span className="profile-field__value">{user?.login_count ?? '-'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Profile;
