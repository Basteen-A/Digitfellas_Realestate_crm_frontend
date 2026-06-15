import React, { useState, useEffect, useCallback } from 'react';
import { TrophyIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import dashboardApi from '../../../api/dashboardApi';
import { getErrorMessage } from '../../../utils/helpers';
import toast from 'react-hot-toast';

const DATE_FILTER_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
];

// Format sqft nicely
const formatSqft = (val) => {
  if (!val || val === 0) return '0';
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return val.toFixed(0);
};

// Telecaller Leaderboard Card
export const TelecallerLeaderboardCard = ({ user }) => {
  const [data, setData] = useState([]);
  const [dateFilter, setDateFilter] = useState('this_month');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await dashboardApi.getTelecallerLeaderboard({ dateFilter });
      setData(resp?.data?.telecallers || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load leaderboard'));
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const currentUserRank = data.find(u => u.id === user?.id);
  const displayData = expanded ? data : data.slice(0, 5);

  return (
    <div className="col-card-new leaderboard-card">
      <div className="col-card-header-new">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrophyIcon style={{ width: 20, height: 20, color: 'var(--accent-yellow, #f59e0b)' }} />
          <div>
            <div className="col-card-title-new">Leaderboard</div>
            <div className="col-card-subtitle-new">Telecaller Performance Rankings</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="leaderboard-filter"
          >
            {DATE_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="col-card-body-flush-new">
        {loading ? (
          <div className="leaderboard-loading">
            <div className="leaderboard-spinner" />
            <span>Loading...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="col-empty-mini">
            <TrophyIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
            <span>No data available</span>
          </div>
        ) : (
          <>
            <div className="leaderboard-list">
              {displayData.map((tc) => (
                <div
                  key={tc.id}
                  className={`leaderboard-item ${tc.id === user?.id ? 'is-current-user' : ''}`}
                >
                  <div className={`leaderboard-rank ${tc.rank <= 3 ? 'top-three' : ''}`}>
                    {tc.rank <= 3 ? (
                      <span className={`rank-medal rank-${tc.rank}`}>{tc.rank}</span>
                    ) : (
                      tc.rank
                    )}
                  </div>
                  <div className="leaderboard-avatar">
                    {tc.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{tc.full_name}</div>
                  </div>
                  <div className="leaderboard-stats">
                    <div className="leaderboard-value">{tc.sv_completed}</div>
                    <div className="leaderboard-label">Site Visits</div>
                  </div>
                </div>
              ))}
            </div>
            {currentUserRank && currentUserRank.rank > 5 && (
              <div className="leaderboard-current-user-bar">
                <div className="leaderboard-item is-current-user">
                  <div className="leaderboard-rank">{currentUserRank.rank}</div>
                  <div className="leaderboard-avatar">
                    {currentUserRank.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{currentUserRank.full_name} (You)</div>
                  </div>
                  <div className="leaderboard-stats">
                    <div className="leaderboard-value">{currentUserRank.sv_completed}</div>
                    <div className="leaderboard-label">Site Visits</div>
                  </div>
                </div>
              </div>
            )}
            {data.length > 5 && (
              <button
                className="leaderboard-expand-btn"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <><ChevronUpIcon style={{ width: 16, height: 16 }} /> Show Less</>
                ) : (
                  <><ChevronDownIcon style={{ width: 16, height: 16 }} /> Show All ({data.length})</>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Sales Manager Leaderboard Card
export const SalesManagerLeaderboardCard = ({ user }) => {
  const [data, setData] = useState([]);
  const [dateFilter, setDateFilter] = useState('this_month');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await dashboardApi.getSalesManagerLeaderboard({ dateFilter });
      setData(resp?.data?.managers || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load leaderboard'));
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const currentUserRank = data.find(u => u.id === user?.id);
  const displayData = expanded ? data : data.slice(0, 5);

  return (
    <div className="col-card-new leaderboard-card">
      <div className="col-card-header-new">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrophyIcon style={{ width: 20, height: 20, color: 'var(--accent-yellow, #f59e0b)' }} />
          <div>
            <div className="col-card-title-new">Leaderboard</div>
            <div className="col-card-subtitle-new">Sales Manager Rankings</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="leaderboard-filter"
          >
            {DATE_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="col-card-body-flush-new">
        {loading ? (
          <div className="leaderboard-loading">
            <div className="leaderboard-spinner" />
            <span>Loading...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="col-empty-mini">
            <TrophyIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
            <span>No data available</span>
          </div>
        ) : (
          <>
            <div className="leaderboard-list">
              {displayData.map((sm) => (
                <div
                  key={sm.id}
                  className={`leaderboard-item ${sm.id === user?.id ? 'is-current-user' : ''}`}
                >
                  <div className={`leaderboard-rank ${sm.rank <= 3 ? 'top-three' : ''}`}>
                    {sm.rank <= 3 ? (
                      <span className={`rank-medal rank-${sm.rank}`}>{sm.rank}</span>
                    ) : (
                      sm.rank
                    )}
                  </div>
                  <div className="leaderboard-avatar">
                    {sm.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{sm.full_name}</div>
                    <div className="leaderboard-meta">
                      {sm.plots_booked} plots · {formatSqft(sm.total_sqft)} sqft
                    </div>
                  </div>
                  <div className="leaderboard-stats">
                    <div className="leaderboard-value">{sm.total_bookings}</div>
                    <div className="leaderboard-label">Bookings</div>
                  </div>
                </div>
              ))}
            </div>
            {currentUserRank && currentUserRank.rank > 5 && (
              <div className="leaderboard-current-user-bar">
                <div className="leaderboard-item is-current-user">
                  <div className="leaderboard-rank">{currentUserRank.rank}</div>
                  <div className="leaderboard-avatar">
                    {currentUserRank.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{currentUserRank.full_name} (You)</div>
                    <div className="leaderboard-meta">
                      {currentUserRank.plots_booked} plots · {formatSqft(currentUserRank.total_sqft)} sqft
                    </div>
                  </div>
                  <div className="leaderboard-stats">
                    <div className="leaderboard-value">{currentUserRank.total_bookings}</div>
                    <div className="leaderboard-label">Bookings</div>
                  </div>
                </div>
              </div>
            )}
            {data.length > 5 && (
              <button
                className="leaderboard-expand-btn"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <><ChevronUpIcon style={{ width: 16, height: 16 }} /> Show Less</>
                ) : (
                  <><ChevronDownIcon style={{ width: 16, height: 16 }} /> Show All ({data.length})</>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Sales Head Leaderboard Card
export const SalesHeadLeaderboardCard = ({ user }) => {
  const [data, setData] = useState([]);
  const [dateFilter, setDateFilter] = useState('this_month');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await dashboardApi.getSalesHeadLeaderboard({ dateFilter });
      setData(resp?.data?.salesHeads || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load leaderboard'));
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const currentUserRank = data.find(u => u.id === user?.id);
  const displayData = expanded ? data : data.slice(0, 5);

  return (
    <div className="col-card-new leaderboard-card">
      <div className="col-card-header-new">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrophyIcon style={{ width: 20, height: 20, color: 'var(--accent-yellow, #f59e0b)' }} />
          <div>
            <div className="col-card-title-new">Leaderboard</div>
            <div className="col-card-subtitle-new">Sales Head Rankings</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="leaderboard-filter"
          >
            {DATE_FILTER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="col-card-body-flush-new">
        {loading ? (
          <div className="leaderboard-loading">
            <div className="leaderboard-spinner" />
            <span>Loading...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="col-empty-mini">
            <TrophyIcon style={{ width: 32, height: 32, opacity: 0.3 }} />
            <span>No data available</span>
          </div>
        ) : (
          <>
            <div className="leaderboard-list">
              {displayData.map((sh) => (
                <div
                  key={sh.id}
                  className={`leaderboard-item ${sh.id === user?.id ? 'is-current-user' : ''}`}
                >
                  <div className={`leaderboard-rank ${sh.rank <= 3 ? 'top-three' : ''}`}>
                    {sh.rank <= 3 ? (
                      <span className={`rank-medal rank-${sh.rank}`}>{sh.rank}</span>
                    ) : (
                      sh.rank
                    )}
                  </div>
                  <div className="leaderboard-avatar">
                    {sh.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{sh.full_name}</div>
                    <div className="leaderboard-meta">
                      {sh.plots_booked} plots · {formatSqft(sh.total_sqft)} sqft
                    </div>
                  </div>
                  <div className="leaderboard-stats">
                    <div className="leaderboard-value">{sh.total_bookings}</div>
                    <div className="leaderboard-label">Bookings</div>
                  </div>
                </div>
              ))}
            </div>
            {currentUserRank && currentUserRank.rank > 5 && (
              <div className="leaderboard-current-user-bar">
                <div className="leaderboard-item is-current-user">
                  <div className="leaderboard-rank">{currentUserRank.rank}</div>
                  <div className="leaderboard-avatar">
                    {currentUserRank.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="leaderboard-info">
                    <div className="leaderboard-name">{currentUserRank.full_name} (You)</div>
                    <div className="leaderboard-meta">
                      {currentUserRank.plots_booked} plots · {formatSqft(currentUserRank.total_sqft)} sqft
                    </div>
                  </div>
                  <div className="leaderboard-stats">
                    <div className="leaderboard-value">{currentUserRank.total_bookings}</div>
                    <div className="leaderboard-label">Bookings</div>
                  </div>
                </div>
              </div>
            )}
            {data.length > 5 && (
              <button
                className="leaderboard-expand-btn"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <><ChevronUpIcon style={{ width: 16, height: 16 }} /> Show Less</>
                ) : (
                  <><ChevronDownIcon style={{ width: 16, height: 16 }} /> Show All ({data.length})</>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
