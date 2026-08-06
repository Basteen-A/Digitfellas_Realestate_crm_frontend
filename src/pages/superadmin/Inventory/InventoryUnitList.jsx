import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/outline';
import inventoryUnitApi from '../../../api/inventoryUnitApi';
import locationApi from '../../../api/locationApi';
import projectApi from '../../../api/projectApi';
import projectPhaseApi from '../../../api/projectPhaseApi';
import Pagination from '../../../components/common/Pagination';
import DangerDeleteModal from '../../../components/common/DangerDeleteModal';
import { formatLocation } from '../../../utils/formatters';
import './InventoryUnitList.css';

const formatCurrency = (val) => {
  const num = parseFloat(val) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)} K`;
  return `₹${num.toLocaleString('en-IN')}`;
};

// Total amount derived from the unit's own guided value × the unit's area.
// Returns null when either piece is missing so the cell can show a dash.
const unitGuidelineAmount = (unit) => {
  const perSqft = parseFloat(unit.guided_value);
  const area = parseFloat(unit.unit_area);
  if (!perSqft || !area) return null;
  return perSqft * area;
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
  phase_id: '',
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
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [projectInfo, setProjectInfo] = useState(null);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('');
  const [query, setQuery] = useState({ page: 1, limit: 25, search: '', unit_status: '', phase_id: '' });

  const [modal, setModal] = useState({ open: false, mode: 'create', row: null });
  const [formValues, setFormValues] = useState({ ...EMPTY_FORM });
  const [dangerUnit, setDangerUnit] = useState(null);

  // Dropdown data for add/edit when no projectId route param
  const [locations, setLocations] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');

  // Phase data - keyed by project_id
  const [phasesByProject, setPhasesByProject] = useState({});
  const [phaseModal, setPhaseModal] = useState({ open: false, mode: 'create', row: null, project_id: '' });
  const [phaseForm, setPhaseForm] = useState({ phase_name: '', phase_code: '', description: '', guideline_value_per_sqft: '', sort_order: 0 });
  const [phaseSaving, setPhaseSaving] = useState(false);

  const filteredProjects = useMemo(() => {
    if (!selectedLocationId) return allProjects;
    return allProjects.filter((p) => p.location_id === selectedLocationId);
  }, [selectedLocationId, allProjects]);

  // Fetch phases for a given project (cached) ──
  const ensurePhasesLoaded = useCallback(async (projId, force = false) => {
    if (!projId) return [];
    if (!force && phasesByProject[projId]) return phasesByProject[projId];
    try {
      const resp = await projectPhaseApi.list({ project_id: projId });
      const list = resp.data?.data || resp.data || [];
      setPhasesByProject((prev) => ({ ...prev, [projId]: list }));
      return list;
    } catch (err) {
      console.error('Failed to load phases', err);
      return [];
    }
  }, [phasesByProject]);

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

      // getAll returns the unwrapped response body: { data: rows, meta: {...} }
      const response = await inventoryUnitApi.getAll(params);
      const rows = response?.data || [];
      const pageMeta = response?.meta || { page: 1, limit: query.limit, total: rows.length, totalPages: 1 };

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

  // Whenever the route-scoped project changes, prefetch its phases
  useEffect(() => {
    if (projectId) ensurePhasesLoaded(projectId);
  }, [projectId, ensurePhasesLoaded]);

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
    if (row.project_id) ensurePhasesLoaded(row.project_id);
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
      // Auto-calculate total_price when area or guided_value changes
      if (name === 'unit_area' || name === 'guided_value') {
        const area = parseFloat(name === 'unit_area' ? value : prev.unit_area) || 0;
        const gv = parseFloat(name === 'guided_value' ? value : prev.guided_value) || 0;
        if (area > 0 && gv > 0) {
          next.total_price = (area * gv).toFixed(2);
        }
      }
      // When project changes, clear phase + fetch phase list
      if (name === 'project_id') {
        next.phase_id = '';
        if (value) ensurePhasesLoaded(value);
      }
      // Picking a phase only PRE-FILLS the guided value box with the phase's
      // guideline rate as a convenient default - it stays a per-unit field the
      // user can edit, and the unit's own guided value is what drives amounts.
      if (name === 'phase_id') {
        const phase = (phasesByProject[prev.project_id] || []).find((p) => String(p.id) === String(value));
        const phaseRate = phase?.guideline_value_per_sqft;
        if (phaseRate != null && phaseRate !== '') {
          next.guided_value = String(phaseRate);
          const area = parseFloat(prev.unit_area) || 0;
          const gv = parseFloat(phaseRate) || 0;
          if (area > 0 && gv > 0) next.total_price = (area * gv).toFixed(2);
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Phase and guided value are mandatory on every add/edit.
    if (!formValues.phase_id) { toast.error('Phase is required'); return; }
    if (formValues.guided_value === '' || formValues.guided_value === null || Number(formValues.guided_value) <= 0) {
      toast.error('Guided value per sqft is required');
      return;
    }

    setSubmitting(true);

    try {
      const payload = { ...formValues };
      // Clean up numeric fields
      ['unit_area', 'price_per_sqft', 'total_price', 'guided_value', 'sort_order'].forEach((f) => {
        payload[f] = payload[f] === '' ? null : Number(payload[f]);
      });
      payload.is_active = Boolean(payload.is_active);
      if (!payload.phase_id) payload.phase_id = null;

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

  const handleDelete = (row) => {
    // Permanent delete via the danger-zone confirmation modal.
    setDangerUnit(row);
  };

  const confirmHardDeleteUnit = async () => {
    await inventoryUnitApi.hardDelete(dangerUnit.id);
    toast.success('Unit permanently deleted');
    setDangerUnit(null);
    loadUnits();
    loadProjectSummary();
  };

  const handleSearch = () => {
    setQuery((prev) => ({ ...prev, page: 1, search: searchInput.trim(), unit_status: statusFilter, phase_id: phaseFilter }));
  };

  // ── Phase CRUD ──
  const openPhaseManager = async (projId) => {
    const useProjId = projId || projectId;
    if (!useProjId) {
      toast.error('Pick a project first to manage its phases');
      return;
    }
    await ensurePhasesLoaded(useProjId, true);
    setPhaseForm({ phase_name: '', phase_code: '', description: '', guideline_value_per_sqft: '', sort_order: 0 });
    setPhaseModal({ open: true, mode: 'create', row: null, project_id: useProjId });
  };
  const closePhaseManager = () => setPhaseModal({ open: false, mode: 'create', row: null, project_id: '' });

  const startEditPhase = (phase) => {
    setPhaseForm({
      phase_name: phase.phase_name || '',
      phase_code: phase.phase_code || '',
      description: phase.description || '',
      guideline_value_per_sqft: phase.guideline_value_per_sqft ?? '',
      sort_order: phase.sort_order ?? 0,
    });
    setPhaseModal((prev) => ({ ...prev, mode: 'edit', row: phase }));
  };

  const submitPhase = async (e) => {
    e?.preventDefault?.();
    if (!phaseForm.phase_name.trim()) { toast.error('Phase name is required'); return; }
    // Guideline value per sq.ft. is mandatory when creating a phase.
    if (phaseModal.mode !== 'edit') {
      const gv = phaseForm.guideline_value_per_sqft;
      if (gv === '' || gv === null || Number(gv) <= 0 || Number.isNaN(Number(gv))) {
        toast.error('Guideline value per sq.ft. is required');
        return;
      }
    }
    setPhaseSaving(true);
    try {
      if (phaseModal.mode === 'edit' && phaseModal.row) {
        await projectPhaseApi.update(phaseModal.row.id, {
          phase_name: phaseForm.phase_name,
          phase_code: phaseForm.phase_code || null,
          description: phaseForm.description || null,
          guideline_value_per_sqft: phaseForm.guideline_value_per_sqft === '' ? null : Number(phaseForm.guideline_value_per_sqft),
          sort_order: Number(phaseForm.sort_order) || 0,
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
        });
        toast.success('Phase created');
      }
      await ensurePhasesLoaded(phaseModal.project_id, true);
      setPhaseForm({ phase_name: '', phase_code: '', description: '', guideline_value_per_sqft: '', sort_order: 0 });
      setPhaseModal((prev) => ({ ...prev, mode: 'create', row: null }));
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
      await ensurePhasesLoaded(phaseModal.project_id, true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete phase');
    }
  };

  return (
    <section className="inv-unit-page">
      {/* ── Header ── */}
      <header className="inv-unit-page__header">
        <div>
          <div className="inv-unit-page__back" onClick={() => navigate('/super-admin/inventory')}>
            ← Back to Inventory Dashboard
          </div>
          <h1>{projectInfo ? `${projectInfo.project_name} - Units` : 'All Inventory Units'}</h1>
        </div>
        <div className="inv-unit-page__actions">
          {projectId && (
            <button className="inv-btn inv-btn--secondary" onClick={() => openPhaseManager(projectId)}>
              Manage Phases
            </button>
          )}
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
              {formatLocation(projectInfo.location?.location_name, projectInfo.location?.city)}
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
              <div className="inv-project-info__stat-value" style={{ color: 'var(--accent-green)' }}>
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
        {projectId && (
          <select
            className="inv-toolbar__filter"
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
          >
            <option value="">All Phases</option>
            {(phasesByProject[projectId] || []).map((p) => (
              <option key={p.id} value={p.id}>{p.phase_name}</option>
            ))}
          </select>
        )}
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
              <th>Phase</th>
              <th>Config</th>
              <th>Area</th>
              <th>Guided Value / sqft</th>
              <th>Guideline Amount</th>
              <th>Total Price</th>
              <th>Block/Tower</th>
              <th>Status</th>
              <th>Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={projectId ? 11 : 12} className="inv-table__empty">Loading...</td>
              </tr>
            )}
            {!loading && units.length === 0 && (
              <tr>
                <td colSpan={projectId ? 11 : 12} className="inv-table__empty">No units found</td>
              </tr>
            )}
            {!loading && units.map((unit) => (
              <tr key={unit.id}>
                <td><strong>{unit.unit_number}</strong></td>
                {!projectId && (
                  <td>{unit.project?.project_name || '-'}</td>
                )}
                <td>{unit.phase?.phase_name || <span style={{ color: '#94a3b8' }}>-</span>}</td>
                <td>{unit.configuration || '-'}</td>
                <td>{unit.unit_area ? `${unit.unit_area} ${unit.area_unit || 'sq.ft.'}` : '-'}</td>
                <td>{unit.guided_value ? `₹${parseFloat(unit.guided_value).toLocaleString('en-IN')}` : '-'}</td>
                <td>
                  {unitGuidelineAmount(unit) != null
                    ? <span title={`${parseFloat(unit.guided_value).toLocaleString('en-IN')} /sq.ft. × ${unit.unit_area} ${unit.area_unit || 'sq.ft.'}`}>
                      {formatCurrency(unitGuidelineAmount(unit))}
                    </span>
                    : <span style={{ color: '#94a3b8' }}>-</span>}
                </td>
                <td>{unit.total_price ? formatCurrency(unit.total_price) : '-'}</td>
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
      <Pagination
        page={meta.page || query.page}
        pageSize={query.limit}
        total={meta.total || 0}
        onPageChange={(p) => setQuery((prev) => ({ ...prev, page: p }))}
        onPageSizeChange={(size) => setQuery((prev) => ({ ...prev, limit: size, page: 1 }))}
      />

      {/* ── Add/Edit Modal ── */}
      {modal.open && (
        <div className="inv-modal" role="dialog" aria-modal="true">
          <div className="inv-modal__panel">
            <header className="inv-modal__header">
              <h2>{modal.mode === 'create' ? 'Add Unit' : 'Edit Unit'}</h2>
              <button onClick={closeModal} aria-label="Close"><XMarkIcon style={{ width: 18, height: 18 }} /></button>
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
                            {loc.location_name}
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
                  <label>
                    Phase <span className="required">*</span>
                    {formValues.project_id && (
                      <button type="button" className="inv-link-btn" style={{ marginLeft: 8, fontSize: 11 }}
                        onClick={() => openPhaseManager(formValues.project_id)}>
                        + Manage
                      </button>
                    )}
                  </label>
                  <select
                    value={formValues.phase_id || ''}
                    required
                    onChange={(e) => handleFieldChange('phase_id', e.target.value)}
                    disabled={!formValues.project_id}
                  >
                    <option value="">{formValues.project_id ? '- Select phase -' : 'Select project first'}</option>
                    {(phasesByProject[formValues.project_id] || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.phase_name}</option>
                    ))}
                  </select>
                </div>

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
                  <label>Guided value per sqft (₹) <span className="required">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formValues.guided_value}
                    required
                    placeholder="e.g. 450"
                    onChange={(e) => handleFieldChange('guided_value', e.target.value)}
                  />
                </div>

                <div className="inv-form__field">
                  <label>Total Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formValues.total_price}
                    placeholder="Auto-calculated or enter manually"
                    onChange={(e) => handleFieldChange('total_price', e.target.value)}
                  />
                </div>

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

      {/* ── Phase Manager Modal ── */}
      {phaseModal.open && (
        <div className="inv-modal" role="dialog" aria-modal="true">
          <div className="inv-modal__panel" style={{ maxWidth: 640 }}>
            <header className="inv-modal__header">
              <h2>Manage Phases</h2>
              <button onClick={closePhaseManager} aria-label="Close"><XMarkIcon style={{ width: 18, height: 18 }} /></button>
            </header>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', marginBottom: 12 }}>
                Phases let you split a project (e.g. Phase 1, Phase 2). Unit numbers are unique <strong>within each phase</strong> - so Phase 1 / Plot 1 and Phase 2 / Plot 1 can both exist.
              </div>

              {/* Existing phases */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Existing phases</div>
                {(phasesByProject[phaseModal.project_id] || []).length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>No phases yet.</div>
                ) : (
                  <table className="inv-table" style={{ width: '100%' }}>
                    <thead>
                      <tr><th>Phase</th><th>Code</th><th>Guideline /sq.ft.</th><th>Units</th><th>Available</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {(phasesByProject[phaseModal.project_id] || []).map((p) => (
                        <tr key={p.id}>
                          <td><strong>{p.phase_name}</strong></td>
                          <td>{p.phase_code || '-'}</td>
                          <td>{p.guideline_value_per_sqft != null && p.guideline_value_per_sqft !== '' ? `₹${Number(p.guideline_value_per_sqft).toLocaleString('en-IN')}` : '-'}</td>
                          <td>{p.unit_count ?? 0}</td>
                          <td>{p.available_count ?? 0}</td>
                          <td>
                            <button className="inv-link-btn" onClick={() => startEditPhase(p)}>Edit</button>
                            <button className="inv-link-btn" style={{ color: '#dc2626', marginLeft: 8 }} onClick={() => removePhase(p)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Create/Edit phase form */}
              <form onSubmit={submitPhase} style={{ borderTop: '1px solid var(--border-primary, #e5e7eb)', paddingTop: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  {phaseModal.mode === 'edit' ? `Edit phase: ${phaseModal.row?.phase_name}` : 'Add new phase'}
                </div>
                <div className="inv-form__grid">
                  <div className="inv-form__field">
                    <label>Phase Name <span className="required">*</span></label>
                    <input value={phaseForm.phase_name} required placeholder="e.g. Phase 1"
                      onChange={(e) => setPhaseForm((p) => ({ ...p, phase_name: e.target.value }))} />
                  </div>
                  <div className="inv-form__field">
                    <label>Phase Code</label>
                    <input value={phaseForm.phase_code} placeholder="e.g. P1"
                      onChange={(e) => setPhaseForm((p) => ({ ...p, phase_code: e.target.value }))} />
                  </div>
                  <div className="inv-form__field" style={{ gridColumn: '1 / -1' }}>
                    <label>Description</label>
                    <input value={phaseForm.description} placeholder="Optional"
                      onChange={(e) => setPhaseForm((p) => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="inv-form__field">
                    <label>Guideline Value / sq.ft. (₹) <span className="required">*</span></label>
                    <input type="number" min="0" step="0.01" value={phaseForm.guideline_value_per_sqft}
                      required={phaseModal.mode !== 'edit'}
                      placeholder="e.g. 3500 - plot amount = this × area"
                      onChange={(e) => setPhaseForm((p) => ({ ...p, guideline_value_per_sqft: e.target.value }))} />
                  </div>
                  <div className="inv-form__field">
                    <label>Sort Order</label>
                    <input type="number" value={phaseForm.sort_order}
                      onChange={(e) => setPhaseForm((p) => ({ ...p, sort_order: e.target.value }))} />
                  </div>
                </div>
                <div className="inv-form__footer" style={{ marginTop: 12 }}>
                  {phaseModal.mode === 'edit' && (
                    <button type="button" className="inv-btn inv-btn--secondary"
                      onClick={() => { setPhaseModal((p) => ({ ...p, mode: 'create', row: null })); setPhaseForm({ phase_name: '', phase_code: '', description: '', guideline_value_per_sqft: '', sort_order: 0 }); }}>
                      Cancel edit
                    </button>
                  )}
                  <button type="submit" className="inv-btn inv-btn--primary" disabled={phaseSaving}>
                    {phaseSaving ? 'Saving...' : (phaseModal.mode === 'edit' ? 'Update Phase' : '+ Add Phase')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <DangerDeleteModal
        open={Boolean(dangerUnit)}
        entityLabel="unit"
        entityName={dangerUnit ? `Unit ${dangerUnit.unit_number}` : ''}
        confirmValue={dangerUnit ? String(dangerUnit.unit_number ?? '') : ''}
        confirmLabel="unit number"
        extraWarning="A unit can only be deleted when no booking has been done on it."
        onClose={() => setDangerUnit(null)}
        onConfirm={confirmHardDeleteUnit}
      />
    </section>
  );
};

export default InventoryUnitList;
