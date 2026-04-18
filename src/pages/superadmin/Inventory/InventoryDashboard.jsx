import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import inventoryUnitApi from '../../../api/inventoryUnitApi';
import './InventoryDashboard.css';

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)} K`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const InventoryDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState({ global: {}, projects: [] });

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const response = await inventoryUnitApi.getDashboard();
      setDashboard(response.data || { global: {}, projects: [] });
    } catch (error) {
      console.error('Dashboard load error:', error);
      toast.error('Failed to load inventory dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const { global, projects } = dashboard;

  if (loading) {
    return (
      <section className="inventory-dashboard">
        <div className="inv-loading">Loading inventory data...</div>
      </section>
    );
  }

  return (
    <section className="inventory-dashboard">
      <header className="inventory-dashboard__header">
        <div>
          <h1>Inventory Management</h1>
          <p>Track plots, villas, and unit availability across all projects</p>
        </div>
      </header>

      {/* ── Global Summary ── */}
      <div className="inv-global-stats">
        <div className="inv-stat-card">
          <div className="inv-stat-card__value inv-stat-card__value--total">
            {parseInt(global.total_units) || 0}
          </div>
          <div className="inv-stat-card__label">Total Units</div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-card__value inv-stat-card__value--available">
            {parseInt(global.available_units) || 0}
          </div>
          <div className="inv-stat-card__label">Available</div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-card__value inv-stat-card__value--booked">
            {parseInt(global.booked_units) || 0}
          </div>
          <div className="inv-stat-card__label">Booked</div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-card__value inv-stat-card__value--sold">
            {parseInt(global.sold_units) || 0}
          </div>
          <div className="inv-stat-card__label">Sold</div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-card__value inv-stat-card__value--revenue">
            {formatCurrency(global.total_value)}
          </div>
          <div className="inv-stat-card__label">Total Value</div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-card__value inv-stat-card__value--booked">
            {formatCurrency(global.booked_value)}
          </div>
          <div className="inv-stat-card__label">Booked Revenue</div>
        </div>
        <div className="inv-stat-card">
          <div className="inv-stat-card__value inv-stat-card__value--sold">
            {formatCurrency(global.sold_value)}
          </div>
          <div className="inv-stat-card__label">Sold Revenue</div>
        </div>
      </div>

      {/* ── Per-Project Cards ── */}
      <h2 className="inv-projects-title">Projects with Inventory</h2>

      {projects.length === 0 ? (
        <div className="inv-empty">
          <div className="inv-empty__icon">📦</div>
          <div className="inv-empty__text">No inventory units found</div>
          <div className="inv-empty__sub">
            Go to a project and add units to start tracking inventory
          </div>
        </div>
      ) : (
        <div className="inv-project-grid">
          {projects.map((proj) => {
            const total = parseInt(proj.total_units) || 0;
            const available = parseInt(proj.available_units) || 0;
            const booked = parseInt(proj.booked_units) || 0;
            const sold = parseInt(proj.sold_units) || 0;
            const soldPct = total > 0 ? (sold / total) * 100 : 0;
            const bookedPct = total > 0 ? (booked / total) * 100 : 0;

            return (
              <div
                key={proj.project_id}
                className="inv-project-card"
                onClick={() => navigate(`/super-admin/inventory/${proj.project_id}`)}
              >
                <div className="inv-project-card__name">
                  {proj.project_name}
                  {proj.project_type && (
                    <span className="inv-project-card__type-badge">{proj.project_type}</span>
                  )}
                </div>
                <div className="inv-project-card__location">
                  {[proj.location_name, proj.city].filter(Boolean).join(', ') || 'No location'}
                </div>

                <div className="inv-project-card__stats">
                  <div className="inv-project-card__stat">
                    <div className="inv-project-card__stat-value" style={{ color: '#3b82f6' }}>
                      {total}
                    </div>
                    <div className="inv-project-card__stat-label">Total</div>
                  </div>
                  <div className="inv-project-card__stat">
                    <div className="inv-project-card__stat-value" style={{ color: '#22c55e' }}>
                      {available}
                    </div>
                    <div className="inv-project-card__stat-label">Available</div>
                  </div>
                  <div className="inv-project-card__stat">
                    <div className="inv-project-card__stat-value" style={{ color: '#f59e0b' }}>
                      {booked}
                    </div>
                    <div className="inv-project-card__stat-label">Booked</div>
                  </div>
                  <div className="inv-project-card__stat">
                    <div className="inv-project-card__stat-value" style={{ color: '#ef4444' }}>
                      {sold}
                    </div>
                    <div className="inv-project-card__stat-label">Sold</div>
                  </div>
                </div>

                <div className="inv-project-card__progress">
                  <div
                    className="inv-project-card__progress-sold"
                    style={{ width: `${soldPct}%` }}
                  />
                  <div
                    className="inv-project-card__progress-booked"
                    style={{ width: `${bookedPct}%` }}
                  />
                </div>

                <div className="inv-project-card__revenue">
                  <span>Booked: <strong>{formatCurrency(proj.booked_value)}</strong></span>
                  <span>Sold: <strong>{formatCurrency(proj.sold_value)}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default InventoryDashboard;
