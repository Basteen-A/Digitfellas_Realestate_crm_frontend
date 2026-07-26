import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon,
  ArrowsRightLeftIcon, XMarkIcon, CircleStackIcon,
} from '@heroicons/react/24/outline';
import Pagination from '../../../components/common/Pagination';
import DangerDeleteModal from '../../../components/common/DangerDeleteModal';
import './MasterCrudPage.css';

const getValueByPath = (row, path) => {
  if (!path) return '';
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), row);
};

const normalizeArray = (value) =>
  String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const MasterCrudPage = ({ config }) => {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState({ page: 1, limit: 25, search: '' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState({ open: false, mode: 'create', row: null });
  const [formValues, setFormValues] = useState({});
  const [fieldOptions, setFieldOptions] = useState({});
  const [multiSelectSearch, setMultiSelectSearch] = useState({});
  const [dangerRow, setDangerRow] = useState(null);
  const [geoCapturing, setGeoCapturing] = useState(false);

  const visibleFields = useMemo(
    () =>
      (config.fields || []).filter((field) => {
        if (modal.mode === 'edit' && field.hideOnEdit) return false;
        if (typeof field.showWhen === 'function' && !field.showWhen(formValues, fieldOptions, modal)) return false;
        return true;
      }),
    [config.fields, modal, formValues, fieldOptions]
  );

  const toInputValue = (field, value) => {
    if (value === undefined || value === null) {
      if (field.type === 'checkbox') return Boolean(field.defaultValue);
      return '';
    }
    if (field.type === 'multitag' && Array.isArray(value)) {
      return value.join(', ');
    }
    if (field.type === 'multiselect' && Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    if (field.type === 'checkbox') return Boolean(value);
    return value;
  };

  const initializeForm = (row = null) => {
    const initial = {};

    (config.fields || []).forEach((field) => {
      if (field.type === 'geofence') {
        // Composite field — owns the latitude / longitude / radius columns.
        initial.latitude = row?.latitude ?? '';
        initial.longitude = row?.longitude ?? '';
        initial.geofence_radius_m = row?.geofence_radius_m ?? '';
        return;
      }
      if (row) {
        const sourceValue = typeof field.getInitialValue === 'function'
          ? field.getInitialValue(row)
          : row[field.name];
        initial[field.name] = toInputValue(field, sourceValue);
      } else if (field.defaultValue !== undefined) {
        initial[field.name] = field.defaultValue;
      } else if (field.type === 'multiselect') {
        initial[field.name] = [];
      } else if (field.type === 'checkbox') {
        initial[field.name] = false;
      } else {
        initial[field.name] = '';
      }
    });

    setFormValues(initial);
  };

  const loadFieldOptions = async () => {
    const optionsResult = {};
    for (const field of config.fields || []) {
      if (field.type !== 'select' && field.type !== 'multiselect') continue;
      if (field.options) {
        optionsResult[field.name] = field.options;
        continue;
      }
      if (field.loadOptions) {
        try {
          optionsResult[field.name] = await field.loadOptions();
        } catch {
          optionsResult[field.name] = [];
        }
      }
    }

    setFieldOptions(optionsResult);
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const response = await config.api.getAll(query);

      // getAll returns the response body. Supports both:
      //   { success, data: [...], meta: {...} }      (meta at top level)
      //   { data: { data: [...], meta: {...} } }     (nested)
      const rows = response.data?.data || response.data || [];
      const meta = response.meta
        || response.data?.meta
        || { page: query.page, limit: query.limit, total: rows.length, totalPages: 1, hasNextPage: false, hasPrevPage: query.page > 1 };

      setRows(rows);
      setMeta(meta);
    } catch (error) {
      console.error('Error loading list:', error);
      toast.error(error.response?.data?.message || `Unable to load ${config.title}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.page, query.limit, query.search]);

  const openCreate = () => {
    initializeForm();
    loadFieldOptions();
    setModal({ open: true, mode: 'create', row: null });
  };

  const openEdit = async (row) => {
    let detailedRow = row;
    if (typeof config.api.getById === 'function' && row?.id) {
      try {
        const response = await config.api.getById(row.id);
        detailedRow = response?.data || row;
      } catch {
        detailedRow = row;
      }
    }

    initializeForm(detailedRow);
    loadFieldOptions();
    setModal({ open: true, mode: 'edit', row: detailedRow });
  };

  const closeModal = () => {
    setModal({ open: false, mode: 'create', row: null });
    setMultiSelectSearch({});
  };

  const buildPayload = () => {
    const payload = {};
    visibleFields.forEach((field) => {
      let value = formValues[field.name];

      if (field.type === 'geofence') {
        const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
        payload.latitude = num(formValues.latitude);
        payload.longitude = num(formValues.longitude);
        payload.geofence_radius_m = num(formValues.geofence_radius_m);
        return;
      }

      if (field.type === 'checkbox') {
        value = Boolean(value);
      } else if (field.type === 'number') {
        value = value === '' ? null : Number(value);
      } else if (field.type === 'multitag') {
        value = normalizeArray(value);
      } else if (field.type === 'multiselect') {
        value = Array.isArray(value) ? value : [];
      } else if (value === '') {
        // `required` may be a predicate (e.g. on_max_status_id is only required when
        // Max Reallotments is set) — resolve it so an optional empty select posts null,
        // not '' (which the API would reject as an invalid id).
        const req = typeof field.required === 'function'
          ? field.required(formValues, fieldOptions, modal)
          : field.required;
        value = req ? '' : null;
      }

      payload[field.name] = value;
    });
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = buildPayload();
      if (modal.mode === 'create') {
        await config.api.create(payload);
        toast.success(`${config.title} record created`);
      } else {
        await config.api.update(modal.row.id, payload);
        toast.success(`${config.title} record updated`);
      }

      closeModal();
      loadList();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    // Entities that opt into hard delete go through the danger-zone modal.
    if (config.dangerDelete) {
      setDangerRow(row);
      return;
    }

    const ok = window.confirm(`Delete this ${config.title} record?`);
    if (!ok) return;

    try {
      await config.api.delete(row.id);
      toast.success('Deleted');
      loadList();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const handleToggleStatus = async (row) => {
    try {
      if (typeof config.api.toggleStatus === 'function') {
        await config.api.toggleStatus(row.id, row.is_active);
      } else {
        await config.api.update(row.id, { is_active: !Boolean(row.is_active) });
      }
      toast.success('Status updated');
      loadList();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Status update failed');
    }
  };

  // Fields that need the full row: long text, multi-value pickers, or explicit opt-in.
  const isFullWidthField = (field) =>
    field.fullWidth || field.type === 'textarea' || field.type === 'multiselect' || field.type === 'geofence';

  const fieldClass = (field, base = 'master-form__field') =>
    `${base}${isFullWidthField(field) ? ' master-form__field--full' : ''}`;

  const renderField = (field) => {
    const value = formValues[field.name];
    const isRequired = typeof field.required === 'function'
      ? field.required(formValues, fieldOptions, modal)
      : field.required;

    if (field.type === 'checkbox') {
      return (
        <label className="master-form__checkbox" key={field.name}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.checked }))}
          />
          <span>{field.label}</span>
        </label>
      );
    }

    if (field.type === 'textarea') {
      return (
        <label className={fieldClass(field)} key={field.name}>
          <span>{field.label}</span>
          <textarea
            value={value || ''}
            required={isRequired}
            placeholder={field.placeholder}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
          />
        </label>
      );
    }

    if (field.type === 'geofence') {
      const lat = formValues.latitude;
      const lng = formValues.longitude;
      const radius = formValues.geofence_radius_m;
      const hasCoords = lat !== '' && lat != null && lng !== '' && lng != null;
      const setVal = (key) => (e) => setFormValues((prev) => ({ ...prev, [key]: e.target.value }));

      const captureCurrent = () => {
        if (!navigator.geolocation) {
          toast.error('Location is not supported by this browser.');
          return;
        }
        setGeoCapturing(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setFormValues((prev) => ({
              ...prev,
              latitude: Number(pos.coords.latitude.toFixed(7)),
              longitude: Number(pos.coords.longitude.toFixed(7)),
              geofence_radius_m: prev.geofence_radius_m || 100,
            }));
            setGeoCapturing(false);
            toast.success(`Location captured (±${Math.round(pos.coords.accuracy)}m accuracy)`);
          },
          (err) => {
            setGeoCapturing(false);
            toast.error(err.code === 1 ? 'Location permission denied — allow location access and retry.' : 'Could not get your location. Try again.');
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      };

      return (
        <div className={fieldClass(field)} key={field.name} style={{ border: '1px solid var(--border-primary, #e5e7eb)', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 600 }}>{field.label || 'Attendance Geofence (Check-In)'}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="master-page__secondary" onClick={captureCurrent} disabled={geoCapturing}>
                📍 {geoCapturing ? 'Locating…' : 'Capture Current Location'}
              </button>
              {hasCoords && (
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="master-page__secondary"
                  style={{ textDecoration: 'none' }}
                >
                  Open in Maps
                </a>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="master-form__field">
              <span>Latitude</span>
              <input type="number" step="any" min="-90" max="90" value={lat ?? ''} onChange={setVal('latitude')} placeholder="e.g. 13.0827" />
            </label>
            <label className="master-form__field">
              <span>Longitude</span>
              <input type="number" step="any" min="-180" max="180" value={lng ?? ''} onChange={setVal('longitude')} placeholder="e.g. 80.2707" />
            </label>
          </div>
          <label className="master-form__field" style={{ marginTop: 10 }}>
            <span>Check-In Radius {radius ? `— ${radius} m` : '(uses the default from Attendance Settings when empty)'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range"
                min="10"
                max="1000"
                step="10"
                value={Number(radius) || 100}
                onChange={setVal('geofence_radius_m')}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min="10"
                max="100000"
                value={radius ?? ''}
                onChange={setVal('geofence_radius_m')}
                placeholder="meters"
                style={{ width: 110 }}
              />
            </div>
          </label>
          <small style={{ color: 'var(--text-muted, #6b7280)', display: 'block', marginTop: 6 }}>
            Telecallers mapped to this location can check in only within this radius of the pinned point.
          </small>
        </div>
      );
    }

    if (field.type === 'select') {
      const baseOptions = fieldOptions[field.name] || [];
      const selectOptions = typeof field.filterOptions === 'function'
        ? field.filterOptions(baseOptions, formValues)
        : baseOptions;
      return (
        <label className={fieldClass(field)} key={field.name}>
          <span>{field.label}</span>
          <select
            value={value || ''}
            required={isRequired}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
          >
            <option value="">{field.placeholder || 'Select'}</option>
            {selectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (field.type === 'multiselect') {
      const selectedValues = Array.isArray(value) ? value.map((item) => String(item)) : [];
      const selectedValueSet = new Set(selectedValues);
      const availableOptions = fieldOptions[field.name] || [];
      const searchText = (multiSelectSearch[field.name] || '').trim().toLowerCase();
      const filteredOptions = availableOptions
          .filter((option) => !selectedValueSet.has(String(option.value)))
          .filter((option) => !searchText || String(option.label || '').toLowerCase().includes(searchText));

      return (
        <label className={fieldClass(field)} key={field.name}>
          <span>{field.label}</span>

          <input
            type="text"
            className="master-form__multiselect-search"
            value={multiSelectSearch[field.name] || ''}
            placeholder={`Search ${field.label}`}
            onChange={(e) => {
              const nextValue = e.target.value;
              setMultiSelectSearch((prev) => ({ ...prev, [field.name]: nextValue }));
            }}
          />

          <select
            value=""
            required={isRequired && selectedValues.length === 0}
            onChange={(e) => {
              const selectedValue = String(e.target.value || '');
              if (!selectedValue) return;

              setFormValues((prev) => {
                const existing = Array.isArray(prev[field.name]) ? prev[field.name].map((item) => String(item)) : [];
                if (existing.includes(selectedValue)) return prev;
                return { ...prev, [field.name]: [...existing, selectedValue] };
              });

              setMultiSelectSearch((prev) => ({ ...prev, [field.name]: '' }));
            }}
          >
            <option value="">Select {field.label}</option>
            {filteredOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {selectedValues.length > 0 && (
            <div className="master-form__chips">
              {selectedValues.map((selectedId) => {
                const option = availableOptions.find((opt) => String(opt.value) === String(selectedId));
                return (
                  <span key={selectedId} className="master-form__chip">
                    {option?.label || selectedId}
                    <button
                      type="button"
                      className="master-form__chip-remove"
                      onClick={() => {
                        setFormValues((prev) => {
                          const existing = Array.isArray(prev[field.name]) ? prev[field.name].map((item) => String(item)) : [];
                          return { ...prev, [field.name]: existing.filter((id) => String(id) !== String(selectedId)) };
                        });
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </label>
      );
    }

    return (
      <label className={fieldClass(field)} key={field.name}>
        <div className="master-form__label-row">
          <span>{field.label}</span>
          {field.name === 'password' && modal.mode === 'edit' && (
            <div 
              className="password-badge" 
              title={modal.row?.password_plain ? "Click to use this password" : "Password was set before this feature was enabled"}
              style={{ 
                backgroundColor: modal.row?.password_plain ? '#dcfce7' : '#f3f4f6', 
                color: modal.row?.password_plain ? '#166534' : '#6b7280', 
                padding: '2px 8px', 
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                border: `1px solid ${modal.row?.password_plain ? '#bbf7d0' : '#e5e7eb'}`,
                cursor: modal.row?.password_plain ? 'pointer' : 'default'
              }}
              onClick={() => modal.row?.password_plain && setFormValues(prev => ({ ...prev, [field.name]: modal.row.password_plain }))}
            >
              {modal.row?.password_plain ? `Current: ${modal.row.password_plain} (Click to Use)` : 'Password Not Recorded (Reset to See)'}
            </div>
          )}
        </div>
        <input
          type={field.type || 'text'}
          value={value || ''}
          required={isRequired}
          placeholder={field.placeholder}
          onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
        />
      </label>
    );
  };

  return (
    <section className="master-page">
      <header className="master-page__header">
        <div>
          <h1>{config.title}</h1>
          <p>Manage master records used across the CRM workflow.</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {config.api.seed && (
            <button
              type="button"
              className="master-page__secondary"
              onClick={async () => {
                if (window.confirm('This will add default records if none exist. Continue?')) {
                  try {
                    const res = await config.api.seed();
                    if (res.message) {
                      toast.success(res.message);
                    } else {
                      toast.success('Seeded successfully');
                    }
                    loadList();
                  } catch (err) {
                    console.error('Seed error:', err);
                    const msg = err.response?.data?.message || err.message || 'Seed failed';
                    toast.error(msg);
                  }
                }
              }}
            >
              <CircleStackIcon className="master-btn-icon" /> Seed Defaults
            </button>
          )}
          <button type="button" className="master-page__primary" onClick={openCreate}>
            <PlusIcon className="master-btn-icon" /> Add New
          </button>
        </div>
      </header>

      <div className="master-page__toolbar">
        <div className="master-page__search-wrap">
          <MagnifyingGlassIcon className="master-page__search-icon" />
          <input
            className="master-page__search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setQuery((prev) => ({ ...prev, page: 1, search: searchInput.trim() })); }}
            placeholder={`Search ${config.title}…`}
          />
        </div>
        <button
          type="button"
          className="master-page__secondary"
          onClick={() => setQuery((prev) => ({ ...prev, page: 1, search: searchInput.trim() }))}
        >
          Search
        </button>
      </div>

      <div className="master-table-wrap">
        <table className="master-table">
          <thead>
            <tr>
              {(config.columns || []).map((col) => (
                <th key={col.header}>{col.header}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={(config.columns?.length || 0) + 1} className="master-table__empty">
                  Loading...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={(config.columns?.length || 0) + 1} className="master-table__empty">
                  No records found
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row) => (
                <tr key={row.id}>
                  {(config.columns || []).map((col, colIdx) => {
                    const raw = col.render ? col.render(row) : getValueByPath(row, col.path);
                    const display = raw ?? '-';
                    if (col.type === 'boolean') {
                      return (
                        <td key={col.name || colIdx}>
                          <span className={`status-pill ${display ? 'status-pill--on' : 'status-pill--off'}`}>
                            {display ? 'Yes' : 'No'}
                          </span>
                        </td>
                      );
                    }
                    return <td key={col.name || colIdx}>{String(display)}</td>;
                  })}
                  <td>
                    <div className="master-table__actions">
                      {(config.rowActions || []).map((action) => (
                        <button
                          key={action.key}
                          type="button"
                          title={action.title}
                          aria-label={action.title}
                          onClick={() => action.onClick(row)}
                        >
                          {action.icon ? <action.icon className="master-action-icon" /> : action.title}
                        </button>
                      ))}
                      <button type="button" title="Edit" aria-label="Edit" onClick={() => openEdit(row)}>
                        <PencilSquareIcon className="master-action-icon" />
                      </button>
                      <button type="button" title="Toggle status" aria-label="Toggle status" onClick={() => handleToggleStatus(row)}>
                        <ArrowsRightLeftIcon className="master-action-icon" />
                      </button>
                      <button type="button" className="danger" title="Delete" aria-label="Delete" onClick={() => handleDelete(row)}>
                        <TrashIcon className="master-action-icon" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={meta.page || query.page}
        pageSize={query.limit}
        total={meta.total || 0}
        onPageChange={(p) => setQuery((prev) => ({ ...prev, page: p }))}
        onPageSizeChange={(size) => setQuery((prev) => ({ ...prev, limit: size, page: 1 }))}
      />

      {modal.open && (
        <div className="master-modal" role="dialog" aria-modal="true">
          <div className="master-modal__panel">
            <header className="master-modal__header">
              <h2>{modal.mode === 'create' ? `Create ${config.title}` : `Edit ${config.title}`}</h2>
              <button type="button" onClick={closeModal} aria-label="Close">
                <XMarkIcon className="master-action-icon" />
              </button>
            </header>

            <form className="master-form" onSubmit={handleSubmit}>
              <div className="master-form__grid">
                {visibleFields.map(renderField)}
              </div>

              <footer className="master-form__footer">
                <button type="button" className="master-page__secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="master-page__primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {config.dangerDelete && (
        <DangerDeleteModal
          open={Boolean(dangerRow)}
          entityLabel={config.dangerDelete.entityLabel || 'record'}
          entityName={dangerRow ? dangerRow[config.dangerDelete.confirmField] : ''}
          confirmValue={dangerRow ? String(dangerRow[config.dangerDelete.confirmField] ?? '') : ''}
          confirmLabel={config.dangerDelete.confirmLabel || 'name'}
          extraWarning={config.dangerDelete.extraWarning || ''}
          onClose={() => setDangerRow(null)}
          onConfirm={async () => {
            await config.dangerDelete.api(dangerRow.id);
            toast.success(`${config.dangerDelete.entityLabel || 'Record'} permanently deleted`);
            setDangerRow(null);
            loadList();
          }}
        />
      )}
    </section>
  );
};

export default MasterCrudPage;
