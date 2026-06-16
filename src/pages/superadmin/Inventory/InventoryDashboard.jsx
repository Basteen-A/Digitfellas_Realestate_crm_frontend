import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CubeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import inventoryUnitApi from '../../../api/inventoryUnitApi';
import projectPhaseApi from '../../../api/projectPhaseApi';
import projectApi from '../../../api/projectApi';
import Pagination from '../../../components/common/Pagination';
import usePagination from '../../../hooks/usePagination';
import './InventoryDashboard.css';

const InventoryDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState({ global: {}, projects: [] });

  // Phase manager state
  const [phaseModal, setPhaseModal] = useState({ open: false, mode: 'create', row: null, project_id: '', project_name: '' });
  const [phaseForm, setPhaseForm] = useState({ phase_name: '', phase_code: '', description: '', guideline_value_per_sqft: '', sort_order: 0, is_approved: true });
  const [phaseSaving, setPhaseSaving] = useState(false);
  const [phaseList, setPhaseList] = useState([]);
  const [phaseCountByProject, setPhaseCountByProject] = useState({});

  // The projects endpoint caps page size at PAGINATION.MAX_LIMIT (100) server-side,
  // so a single large `limit` request silently drops every project past the newest 100.
  // Page through all of them so the inventory list stays complete.
  const fetchAllProjects = async () => {
    const PAGE_SIZE = 100;
    const first = await projectApi.getAll({ page: 1, limit: PAGE_SIZE });
    const firstRows = first.data || [];
    const totalPages = first.meta?.totalPages || 1;
    if (totalPages <= 1) return firstRows;

    const restPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        projectApi
          .getAll({ page: i + 2, limit: PAGE_SIZE })
          .then((r) => r.data || [])
          .catch(() => [])
      )
    );
    return restPages.reduce((acc, rows) => acc.concat(rows), firstRows);
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // Fetch all projects to show complete list
      const [dashboardResponse, allProjects] = await Promise.all([
        inventoryUnitApi.getDashboard().catch(() => ({ data: { global: {}, projects: [] } })),
        fetchAllProjects().catch(() => []),
      ]);

      const dashboardData = dashboardResponse.data || { global: {}, projects: [] };
      
      // Create a map of projects with inventory data
      const projectsWithInventory = new Map(
        (dashboardData.projects || []).map(p => [p.project_id, p])
      );
      
      // Merge all projects with their inventory data (if available)
      const mergedProjects = allProjects.map(project => {
        const inventoryData = projectsWithInventory.get(project.id);
        if (inventoryData) {
          return inventoryData;
        }
        // Return project with zero inventory stats
        return {
          project_id: project.id,
          project_name: project.project_name,
          project_type: project.projectType?.type_name || project.project_type,
          location_name: project.location?.location_name,
          city: project.location?.city,
          total_units: 0,
          available_units: 0,
          booked_units: 0,
          sold_units: 0,
          booked_value: 0,
          sold_value: 0,
        };
      });
      
      setDashboard({
        global: dashboardData.global || {},
        projects: mergedProjects,
      });
    } catch (error) {
      console.error('Dashboard load error:', error);
      toast.error('Failed to load inventory dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Fetch phase counts for all projects so we can show a badge on each card
  const loadPhaseCounts = useCallback(async () => {
    try {
      const resp = await projectPhaseApi.list();
      const rows = resp.data?.data || resp.data || [];
      const map = rows.reduce((acc, p) => {
        acc[p.project_id] = (acc[p.project_id] || 0) + 1;
        return acc;
      }, {});
      setPhaseCountByProject(map);
    } catch (e) {
      setPhaseCountByProject({});
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadPhaseCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPhaseCounts]);

  // ── Phase CRUD ──
  const refreshPhaseList = async (projectId) => {
    try {
      const resp = await projectPhaseApi.list({ project_id: projectId });
      setPhaseList(resp.data?.data || resp.data || []);
    } catch (e) {
      setPhaseList([]);
    }
  };

  const openPhaseModal = async (e, project) => {
    e.stopPropagation();
    setPhaseForm({ phase_name: '', phase_code: '', description: '', guideline_value_per_sqft: '', sort_order: 0, is_approved: true });
    setPhaseModal({ open: true, mode: 'create', row: null, project_id: project.project_id, project_name: project.project_name });
    await refreshPhaseList(project.project_id);
  };
  const closePhaseModal = () => {
    setPhaseModal({ open: false, mode: 'create', row: null, project_id: '', project_name: '' });
    setPhaseForm({ phase_name: '', phase_code: '', description: '', guideline_value_per_sqft: '', sort_order: 0, is_approved: true });
    setPhaseList([]);
  };

  const startEditPhase = (phase) => {
    setPhaseForm({
      phase_name: phase.phase_name || '',
      phase_code: phase.phase_code || '',
      description: phase.description || '',
      guideline_value_per_sqft: phase.guideline_value_per_sqft ?? '',
      sort_order: phase.sort_order ?? 0,
      is_approved: phase.is_approved !== false,
    });
    setPhaseModal((prev) => ({ ...prev, mode: 'edit', row: phase }));
  };

  const submitPhase = async (e) => {
    e?.preventDefault?.();
    if (!phaseForm.phase_name.trim()) { toast.error('Phase name is required'); return; }
    setPhaseSaving(true);
    try {
      if (phaseModal.mode === 'edit' && phaseModal.row) {
        await projectPhaseApi.update(phaseModal.row.id, {
          phase_name: phaseForm.phase_name,
          phase_code: phaseForm.phase_code || null,
          description: phaseForm.description || null,
          guideline_value_per_sqft: phaseForm.guideline_value_per_sqft === '' ? null : Number(phaseForm.guideline_value_per_sqft),
          sort_order: Number(phaseForm.sort_order) || 0,
          is_approved: phaseForm.is_approved,
        });
        toast.success('Phase updated');
      } else {
        await projectPhaseApi.create({
          project_id: phaseModal.project_id,
          phase_name: phaseForm.phase_name,
          phase_code: phaseForm.phase_code || null,
          description: phaseForm.description || null,
          guideline_value_per_sqft: phaseForm.guideline_value_per_sqft === '' ? null : Number(phaseForm.guideline_value_per_sqft),
          sort_order: Number(phaseForm.sort_order) || 0,
          is_approved: phaseForm.is_approved,
        });
        toast.success('Phase created');
      }
      setPhaseForm({ phase_name: '', phase_code: '', description: '', guideline_value_per_sqft: '', sort_order: 0, is_approved: true });
      setPhaseModal((prev) => ({ ...prev, mode: 'create', row: null }));
      await refreshPhaseList(phaseModal.project_id);
      loadPhaseCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save phase');
    } finally {
      setPhaseSaving(false);
    }
  };

  const removePhase = async (phase) => {
    if (!window.confirm(`Delete phase "${phase.phase_name}"?`)) return;
    try {
      await projectPhaseApi.remove(phase.id);
      toast.success('Phase deleted');
      await refreshPhaseList(phaseModal.project_id);
      loadPhaseCounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete phase');
    }
  };

  const togglePhaseApproval = async (phase) => {
    try {
      await projectPhaseApi.update(phase.id, { is_approved: !phase.is_approved });
      toast.success(phase.is_approved ? 'Phase unapproved' : 'Phase approved');
      await refreshPhaseList(phaseModal.project_id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update approval');
    }
  };

  const { global, projects } = dashboard;
  const { pageItems: pagedProjects, page, setPage, pageSize, setPageSize, total } = usePagination(projects, 25);

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
      </div>

      {/* ── Per-Project Cards ── */}
      <h2 className="inv-projects-title">Projects with Inventory</h2>

      {projects.length === 0 ? (
        <div className="inv-empty">
          <div className="inv-empty__icon"><CubeIcon style={{ width: 40, height: 40 }} /></div>
          <div className="inv-empty__text">No inventory units found</div>
          <div className="inv-empty__sub">
            Go to a project and add units to start tracking inventory
          </div>
        </div>
      ) : (
        <>
          <div className="inv-project-grid">
          {pagedProjects.map((proj) => {
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
                  <span style={{
                    marginLeft: 8, fontSize: 11, fontWeight: 600, padding: '2px 8px',
                    borderRadius: 10, background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE',
                  }}>
                    {phaseCountByProject[proj.project_id] || 0} phase{(phaseCountByProject[proj.project_id] || 0) === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="inv-project-card__location">
                  {[proj.location_name, proj.city].filter(Boolean).join(', ') || 'No location'}
                </div>
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={(e) => openPhaseModal(e, proj)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 10px',
                      borderRadius: 6, border: '1px solid #C7D2FE', background: '#fff',
                      color: '#4338CA', cursor: 'pointer',
                    }}
                  >
                    Manage Phases
                  </button>
                </div>

                <div className="inv-project-card__stats">
                  <div className="inv-project-card__stat">
                    <div className="inv-project-card__stat-value" style={{ color: '#3b82f6' }}>
                      {total}
                    </div>
                    <div className="inv-project-card__stat-label">Total</div>
                  </div>
                  <div className="inv-project-card__stat">
                    <div className="inv-project-card__stat-value" style={{ color: 'var(--accent-green)' }}>
                      {available}
                    </div>
                    <div className="inv-project-card__stat-label">Available</div>
                  </div>
                  {/* <div className="inv-project-card__stat">
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
                  </div> */}
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

                {/* <div className="inv-project-card__revenue">
                  <span>Booked: <strong>{formatCurrency(proj.booked_value)}</strong></span>
                  <span>Sold: <strong>{formatCurrency(proj.sold_value)}</strong></span>
                </div> */}
              </div>
            );
          })}
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {/* ── Phase Manager Modal ── */}
      {phaseModal.open && (
        <div
          onClick={closePhaseModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, width: '640px', maxWidth: '92vw',
              maxHeight: '88vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            <header style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 20px', borderBottom: '1px solid #e5e7eb',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Manage Phases</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{phaseModal.project_name}</div>
              </div>
              <button onClick={closePhaseModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', display: 'inline-flex', padding: 4 }} aria-label="Close"><XMarkIcon style={{ width: 20, height: 20 }} /></button>
            </header>

            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
                Phases split a project (e.g. Phase 1, Phase 2). Unit numbers are unique <strong>within each phase</strong>, so Phase 1 / Plot 1 and Phase 2 / Plot 1 can both exist.
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Existing phases</div>
                {phaseList.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#6b7280', padding: '12px', background: '#f9fafb', borderRadius: 8 }}>
                    No phases yet — add your first below.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                        <th style={{ padding: '6px 8px' }}>Phase</th>
                        <th style={{ padding: '6px 8px' }}>Code</th>
                        <th style={{ padding: '6px 8px' }}>Guideline /sq.ft.</th>
                        <th style={{ padding: '6px 8px' }}>Units</th>
                        <th style={{ padding: '6px 8px' }}>Available</th>
                        <th style={{ padding: '6px 8px' }}>Approval</th>
                        <th style={{ padding: '6px 8px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phaseList.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 8px' }}><strong>{p.phase_name}</strong></td>
                          <td style={{ padding: '6px 8px' }}>{p.phase_code || '—'}</td>
                          <td style={{ padding: '6px 8px' }}>
                            {p.guideline_value_per_sqft != null && p.guideline_value_per_sqft !== ''
                              ? `₹${Number(p.guideline_value_per_sqft).toLocaleString('en-IN')}`
                              : '—'}
                          </td>
                          <td style={{ padding: '6px 8px' }}>{p.unit_count ?? 0}</td>
                          <td style={{ padding: '6px 8px' }}>{p.available_count ?? 0}</td>
                          <td style={{ padding: '6px 8px' }}>
                            <button
                              onClick={() => togglePhaseApproval(p)}
                              title="Click to toggle approval"
                              style={{
                                cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                                border: `1px solid ${p.is_approved === false ? '#FCA5A5' : '#A7F3D0'}`,
                                background: p.is_approved === false ? '#FEF2F2' : '#ECFDF5',
                                color: p.is_approved === false ? '#B91C1C' : '#047857',
                              }}
                            >
                              {p.is_approved === false ? 'Unapproved' : 'Approved'}
                            </button>
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <button onClick={() => startEditPhase(p)} style={{ background: 'none', border: 'none', color: '#4338CA', fontWeight: 600, cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => removePhase(p)} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 600, cursor: 'pointer', marginLeft: 8 }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <form onSubmit={submitPhase} style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  {phaseModal.mode === 'edit' ? `Edit phase: ${phaseModal.row?.phase_name}` : 'Add new phase'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Phase Name *</label>
                    <input
                      value={phaseForm.phase_name} required placeholder="e.g. Phase 1"
                      onChange={(e) => setPhaseForm((p) => ({ ...p, phase_name: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Phase Code</label>
                    <input
                      value={phaseForm.phase_code} placeholder="e.g. P1"
                      onChange={(e) => setPhaseForm((p) => ({ ...p, phase_code: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
                    <input
                      value={phaseForm.description} placeholder="Optional"
                      onChange={(e) => setPhaseForm((p) => ({ ...p, description: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Guideline Value / sq.ft.</label>
                    <input
                      type="number" min="0" step="0.01" value={phaseForm.guideline_value_per_sqft}
                      placeholder="e.g. 3500"
                      onChange={(e) => setPhaseForm((p) => ({ ...p, guideline_value_per_sqft: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                    />
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Plot amount = this × plot area</div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Sort Order</label>
                    <input
                      type="number" value={phaseForm.sort_order}
                      onChange={(e) => setPhaseForm((p) => ({ ...p, sort_order: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'end', paddingBottom: 6 }}>
                    <input
                      id="phase-approved" type="checkbox" checked={phaseForm.is_approved}
                      onChange={(e) => setPhaseForm((p) => ({ ...p, is_approved: e.target.checked }))}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="phase-approved" style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Approved (shown in phase dropdowns)
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
                  {phaseModal.mode === 'edit' && (
                    <button
                      type="button"
                      onClick={() => { setPhaseModal((p) => ({ ...p, mode: 'create', row: null })); setPhaseForm({ phase_name: '', phase_code: '', description: '', guideline_value_per_sqft: '', sort_order: 0, is_approved: true }); }}
                      style={{ padding: '8px 14px', border: '1px solid #d1d5db', background: '#fff', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Cancel edit
                    </button>
                  )}
                  <button
                    type="submit" disabled={phaseSaving}
                    style={{ padding: '8px 14px', border: 'none', background: '#4338CA', color: '#fff', borderRadius: 6, fontWeight: 600, cursor: phaseSaving ? 'not-allowed' : 'pointer' }}
                  >
                    {phaseSaving ? 'Saving...' : (phaseModal.mode === 'edit' ? 'Update Phase' : '+ Add Phase')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default InventoryDashboard;
