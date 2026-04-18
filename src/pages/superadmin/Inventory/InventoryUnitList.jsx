import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import inventoryUnitApi from '../../../api/inventoryUnitApi';
import locationApi from '../../../api/locationApi';
import projectApi from '../../../api/projectApi';
import './InventoryUnitList.css';

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)} K`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const statusClass = (status) => {
  switch (status) {
    case 'Available': return 'inv-status--available';
    case 'Booked': return 'inv-status--booked';
    case 'Sold': return 'inv-status--sold';
    default: return '';
  }
};

const EMPTY_FORM = {
  project_id: '',
  unit_number: '',
  unit_area: '',
  area_unit: 'sq.ft.',
  price_per_sqft: '',
  total_price: '',
  guided_value: '',
  floor_number: '',
  tower_block: '',
  configuration: '',
  facing: '',
  other_info: '',
  sort_order: 0,
  is_active: true,
};

const InventoryUnitList = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [units, setUnits] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [projectInfo, setProjectInfo] = useState(null);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState({ page: 1, limit: 50, search: '', unit_status: '' });

  const [modal, setModal] = useState({ open: false, mode: 'create', row: null });
  const [formValues, setFormValues] = useState({ ...EMPTY_FORM });

  // Dropdown data for add/edit when no projectId route param
  const [locations, setLocations] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');

  const filteredProjects = useMemo(() => {
    if (!selectedLocationId) return allProjects;
    return allProjects.filter((p) => p.location_id === selectedLocationId);
  }, [selectedLocationId, allProjects]);

  // Load locations & projects for dropdowns
  const loadDropdowns = useCallback(async () => {
    try {
      const [locRes, projRes] = await Promise.all([
        locationApi.getDropdown(),
        projectApi.getDropdown(),
      ]);
      setLocations(locRes.data || []);
      setAllProjects(projRes.data || []);
    } catch (err) {
      console.error('Dropdown load error:', err);
    }
  }, []);

  // Load project summary
  const loadProjectSummary = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await inventoryUnitApi.getProjectSummary(projectId);
      setProjectInfo(response.data?.project || null);
      setStats(response.data?.stats || {});
    } catch (err) {
      console.error('Project summary error:', err);
    }
  }, [projectId]);

  // Load units
  const loadUnits = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...query };
      if (projectId) params.project_id = projectId;

      const response = await inventoryUnitApi.getAll(params);
      const rows = response.data?.data || response.data || [];
      const pageMeta = response.data?.meta || { page: 1, limit: 50, total: 0, totalPages: 1 };

      setUnits(rows);
      setMeta(pageMeta);
    } catch (error) {
      console.error('Load units error:', error);
      toast.error('Failed to load units');
    } finally {
      setLoading(false);
    }
  }, [query, projectId]);

  useEffect(() => {
    loadUnits();
    loadProjectSummary();
  }, [loadUnits, loadProjectSummary]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  // ── Form helpers ──
  const openCreate = () => {
    const initial = { ...EMPTY_FORM };
    if (projectId) {
      initial.project_id = projectId;
      // Pre-select location from project info
      if (projectInfo?.location?.id) {
        setSelectedLocationId(projectInfo.location.id);
      }
    }
    setFormValues(initial);
    setModal({ open: true, mode: 'create', row: null });
  };

  const openEdit = (row) => {
    const initial = {};
    Object.keys(EMPTY_FORM).forEach((key) => {
      initial[key] = row[key] !== undefined && row[key] !== null ? row[key] : EMPTY_FORM[key];
    });
    // Set location from project
    if (row.project?.location_id) {
      setSelectedLocationId(row.project.location_id);
    }
    setFormValues(initial);
    setModal({ open: true, mode: 'edit', row });
  };

  const closeModal = () => {
    setModal({ open: false, mode: 'create', row: null });
    setSelectedLocationId('');
  };

  const handleFieldChange = (name, value) => {
    setFormValues((prev) => {
      const next = { ...prev, [name]: value };
      // Auto-calculate total_price when area or price_per_sqft changes
      if (name === 'unit_area' || name === 'price_per_sqft') {
        const area = parseFloat(name === 'unit_area' ? value : prev.unit_area) || 0;
        const ppsf = parseFloat(name === 'price_per_sqft' ? value : prev.price_per_sqft) || 0;
        if (area > 0 && ppsf > 0) {
          next.total_price = (area * ppsf).toFixed(2);
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = { ...formValues };
      // Clean up numeric fields
      ['unit_area', 'price_per_sqft', 'total_price', 'guided_value', 'sort_order'].forEach((f) => {
        payload[f] = payload[f] === '' ? null : Number(payload[f]);
      });
      payload.is_active = Boolean(payload.is_active);

      if (modal.mode === 'create') {
        await inventoryUnitApi.create(payload);
        toast.success('Unit created');
      } else {
        await inventoryUnitApi.update(modal.row.id, payload);
        toast.success('Unit updated');
      }

      closeModal();
      loadUnits();
      loadProjectSummary();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete unit "${row.unit_number}"?`)) return;
    try {
      await inventoryUnitApi.delete(row.id);
      toast.success('Unit deleted');
      loadUnits();
      loadProjectSummary();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const handleSearch = () => {
    setQuery((prev) => ({ ...prev, page: 1, search: searchInput.trim(), unit_status: statusFilter }));
  };

  return (
    <section className="inv-unit-page">
      {/* ── Header ── */}
      <header className="inv-unit-page__header">
        <div>
          <div className="inv-unit-page__back" onClick={() => navigate('/super-admin/inventory')}>
            ← Back to Inventory Dashboard
          </div>
          <h1>{projectInfo ? `${projectInfo.project_name} — Units` : 'All Inventory Units'}</h1>
        </div>
        <div className="inv-unit-page__actions">
          <button className="inv-btn inv-btn--primary" onClick={openCreate}>
            + Add Unit
          </button>
        </div>
      </header>

      {/* ── Project Summary Bar ── */}
      {projectInfo && (
        <div className="inv-project-info">
          <div>
            <div className="inv-project-info__name">{projectInfo.project_name}</div>
            <div className="inv-project-info__detail">
              {[projectInfo.location?.location_name, projectInfo.location?.city].filter(Boolean).join(', ')}
              {projectInfo.projectType ? ` • ${projectInfo.projectType.type_name}` : ''}
            </div>
          </div>
          <div className="inv-project-info__stats">
            <div className="inv-project-info__stat">
              <div className="inv-project-info__stat-value" style={{ color: '#3b82f6' }}>
                {parseInt(stats.total_units) || 0}
              </div>
              <div className="inv-project-info__stat-label">Total</div>
            </div>
            <div className="inv-project-info__stat">
              <div className="inv-project-info__stat-value" style={{ color: '#22c55e' }}>
                {parseInt(stats.available_units) || 0}
              </div>
              <div className="inv-project-info__stat-label">Available</div>
            </div>
            <div className="inv-project-info__stat">
              <div className="inv-project-info__stat-value" style={{ color: '#f59e0b' }}>
                {parseInt(stats.booked_units) || 0}
              </div>
              <div className="inv-project-info__stat-label">Booked</div>
            </div>
            <div className="inv-project-info__stat">
              <div className="inv-project-info__stat-value" style={{ color: '#ef4444' }}>
                {parseInt(stats.sold_units) || 0}
              </div>
              <div className="inv-project-info__stat-label">Sold</div>
            </div>
            <div className="inv-project-info__stat">
              <div className="inv-project-info__stat-value" style={{ color: '#8b5cf6' }}>
                {formatCurrency(stats.total_value)}
              </div>
              <div className="inv-project-info__stat-label">Total Value</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="inv-toolbar">
        <input
          className="inv-toolbar__search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search unit number, config, block..."
        />
        <select
          className="inv-toolbar__filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="Available">Available</option>
          <option value="Booked">Booked</option>
          <option value="Sold">Sold</option>
        </select>
        <button className="inv-btn inv-btn--secondary" onClick={handleSearch}>
          Search
        </button>
      </div>

      {/* ── Table ── */}
      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Unit #</th>
              {!projectId && <th>Project</th>}
              <th>Config</th>
              <th>Area</th>
              <th>₹/sqft</th>
              <th>Total Price</th>
              <th>Guided Value</th>
              <th>Block/Tower</th>
              <th>Status</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={projectId ? 10 : 11} className="inv-table__empty">Loading...</td>
              </tr>
            )}
            {!loading && units.length === 0 && (
              <tr>
                <td colSpan={projectId ? 10 : 11} className="inv-table__empty">No units found</td>
              </tr>
            )}
            {!loading && units.map((unit) => (
              <tr key={unit.id}>
                <td><strong>{unit.unit_number}</strong></td>
                {!projectId && (
                  <td>{unit.project?.project_name || '-'}</td>
                )}
                <td>{unit.configuration || '-'}</td>
                <td>{unit.unit_area ? `${unit.unit_area} ${unit.area_unit || 'sq.ft.'}` : '-'}</td>
                <td>{unit.price_per_sqft ? `₹${parseFloat(unit.price_per_sqft).toLocaleString('en-IN')}` : '-'}</td>
                <td>{unit.total_price ? formatCurrency(unit.total_price) : '-'}</td>
                <td>{unit.guided_value ? formatCurrency(unit.guided_value) : '-'}</td>
                <td>{unit.tower_block || '-'}</td>
                <td>
                  <span className={`inv-status ${statusClass(unit.unit_status)}`}>
                    {unit.unit_status}
                  </span>
                </td>
                <td>
                  <span className={`status-pill ${unit.is_active ? 'status-pill--on' : 'status-pill--off'}`}>
                    {unit.is_active ? 'Yes' : 'No'}
                  </span>
                </td>
                <td>
                  <div className="inv-table__actions">
                    <button onClick={() => openEdit(unit)}>Edit</button>
                    <button className="danger" onClick={() => handleDelete(unit)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="inv-pagination">
        <span>
          Showing page {meta.page || 1} of {meta.totalPages || 1} ({meta.total || 0} units)
        </span>
        <div>
          <button
            disabled={!meta.hasPrevPage}
            onClick={() => setQuery((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
          >
            Prev
          </button>
          <button
            disabled={!meta.hasNextPage}
            onClick={() => setQuery((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </button>
        </div>
      </div>

      {/* ── Add/Edit Modal ── */}
      {modal.open && (
        <div className="inv-modal" role="dialog" aria-modal="true">
          <div className="inv-modal__panel">
            <header className="inv-modal__header">
              <h2>{modal.mode === 'create' ? 'Add Unit' : 'Edit Unit'}</h2>
              <button onClick={closeModal}>✕</button>
            </header>

            <form className="inv-form" onSubmit={handleSubmit}>
              <div className="inv-form__grid">
                {/* Location → Project cascading */}
                {!projectId && (
                  <>
                    <div className="inv-form__field">
                      <label>Location</label>
                      <select
                        value={selectedLocationId}
                        onChange={(e) => {
                          setSelectedLocationId(e.target.value);
                          setFormValues((prev) => ({ ...prev, project_id: '' }));
                        }}
                      >
                        <option value="">Select Location</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {[loc.location_name, loc.city].filter(Boolean).join(', ')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="inv-form__field">
                      <label>Project <span className="required">*</span></label>
                      <select
                        value={formValues.project_id}
                        required
                        onChange={(e) => handleFieldChange('project_id', e.target.value)}
                      >
                        <option value="">Select Project</option>
                        {filteredProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.project_name} {p.project_code ? `(${p.project_code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="inv-form__field">
                  <label>Unit Number <span className="required">*</span></label>
                  <input
                    type="text"
                    value={formValues.unit_number}
                    required
                    placeholder="e.g. Plot-01, A-101"
                    onChange={(e) => handleFieldChange('unit_number', e.target.value)}
                  />
                </div>

                <div className="inv-form__field">
                  <label>Configuration</label>
                  <input
                    type="text"
                    value={formValues.configuration}
                    placeholder="e.g. 2BHK, Villa, Plot"
                    onChange={(e) => handleFieldChange('configuration', e.target.value)}
                  />
                </div>

                <div className="inv-form__field">
                  <label>Unit Area</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formValues.unit_area}
                    placeholder="e.g. 1200"
                    onChange={(e) => handleFieldChange('unit_area', e.target.value)}
                  />
                </div>

                <div className="inv-form__field">
                  <label>Area Unit</label>
                  <select
                    value={formValues.area_unit}
                    onChange={(e) => handleFieldChange('area_unit', e.target.value)}
                  >
                    <option value="sq.ft.">sq.ft.</option>
                    <option value="sq.m.">sq.m.</option>
                    <option value="sq.yd.">sq.yd.</option>
                    <option value="acres">acres</option>
                    <option value="guntha">guntha</option>
                  </select>
                </div>

                <div className="inv-form__field">
                  <label>Guided  value per sqft (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formValues.price_per_sqft}
                    placeholder="e.g. 500"
                    onChange={(e) => handleFieldChange('price_per_sqft', e.target.value)}
                  />
                </div>

                {/* <div className="inv-form__field">
                  <label>Total Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formValues.total_price}
                    placeholder="Auto-calculated or enter manually"
                    onChange={(e) => handleFieldChange('total_price', e.target.value)}
                  />
                </div> */}
                <div className="inv-form__field">
                  <label>Facing</label>
                  <select
                    value={formValues.facing}
                    onChange={(e) => handleFieldChange('facing', e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="East">East</option>
                    <option value="West">West</option>
                    <option value="North">North</option>
                    <option value="South">South</option>
                    <option value="North-East">North-East</option>
                    <option value="North-West">North-West</option>
                    <option value="South-East">South-East</option>
                    <option value="South-West">South-West</option>
                  </select>
                </div>

                <div className="inv-form__field">
                  <label>Block / Tower</label>
                  <input
                    type="text"
                    value={formValues.tower_block}
                    placeholder="e.g. A-Block, Tower 2"
                    onChange={(e) => handleFieldChange('tower_block', e.target.value)}
                  />
                </div>

                <div className="inv-form__field">
                  <label>Floor</label>
                  <input
                    type="text"
                    value={formValues.floor_number}
                    placeholder="e.g. Ground, 1st, 2nd"
                    onChange={(e) => handleFieldChange('floor_number', e.target.value)}
                  />
                </div>

                <div className="inv-form__field">
                  <label>Sort Order</label>
                  <input
                    type="number"
                    value={formValues.sort_order}
                    onChange={(e) => handleFieldChange('sort_order', e.target.value)}
                  />
                </div>

                <div className="inv-form__field inv-form__field--full">
                  <label>Other Info / Details</label>
                  <textarea
                    value={formValues.other_info}
                    placeholder="Any additional details about this unit..."
                    onChange={(e) => handleFieldChange('other_info', e.target.value)}
                  />
                </div>

                {modal.mode === 'edit' && (
                  <div className="inv-form__field">
                    <label>Unit Status</label>
                    <select
                      value={formValues.unit_status || 'Available'}
                      onChange={(e) => handleFieldChange('unit_status', e.target.value)}
                    >
                      <option value="Available">Available</option>
                      <option value="Booked">Booked</option>
                      <option value="Sold">Sold</option>
                    </select>
                  </div>
                )}

                <div className="inv-form__field">
                  <div className="inv-form__checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(formValues.is_active)}
                      onChange={(e) => handleFieldChange('is_active', e.target.checked)}
                    />
                    <span>Active</span>
                  </div>
                </div>
              </div>

              <div className="inv-form__footer">
                <button type="button" className="inv-btn inv-btn--secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="inv-btn inv-btn--primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default InventoryUnitList;
