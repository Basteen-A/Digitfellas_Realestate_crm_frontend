// ============================================================
// ROLE WORKSPACES - read-only view banner
// Shown on every page while a Super Admin / Admin is viewing
// another user's portal. Exiting restores the admin's own session.
// ============================================================

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { EyeIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';
import { getViewAs, clearViewAs } from '../../utils/viewAs';
import { loadUser } from '../../redux/slices/authSlice';
import './ViewAsBanner.css';

const ViewAsBanner = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Re-read on identity change so entering/leaving a workspace repaints the bar.
  useSelector((state) => state.auth.user);
  const viewAs = getViewAs();

  // The dim-the-actions layer is keyed off the body so it reaches content
  // rendered outside this subtree (modals, drawers, portals).
  React.useEffect(() => {
    if (!viewAs) return undefined;
    document.body.classList.add('view-as-readonly');
    return () => document.body.classList.remove('view-as-readonly');
  }, [viewAs]);

  if (!viewAs) return null;

  const exit = async () => {
    clearViewAs();
    // Re-read the profile with the header gone, so redux (and with it the
    // sidebar, routes and every page) becomes the real admin again.
    await dispatch(loadUser());
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="view-as-banner" role="status">
      <EyeIcon className="view-as-banner__icon" aria-hidden="true" />
      <div className="view-as-banner__text">
        Viewing <strong>{viewAs.name}</strong>
        {viewAs.roleName ? <span className="view-as-banner__role">{viewAs.roleName}</span> : null}
        <span className="view-as-banner__flag">Read-only</span>
      </div>
      <button type="button" className="view-as-banner__exit" onClick={exit}>
        <ArrowLeftOnRectangleIcon aria-hidden="true" />
        Exit view
      </button>
    </div>
  );
};

export default ViewAsBanner;
