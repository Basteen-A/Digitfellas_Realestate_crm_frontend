import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
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
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState({ page: 1, limit: 20, search: '' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState({ open: false, mode: 'create', row: null });
  const [formValues, setFormValues] = useState({});
  const [fieldOptions, setFieldOptions] = useState({});

  const visibleFields = useMemo(
    () =>
      (config.fields || []).filter((field) => {
        if (modal.mode === 'edit' && field.hideOnEdit) return false;
        return true;
      }),
    [config.fields, modal.mode]
  );

  const toInputValue = (field, value) => {
    if (value === undefined || value === null) {
      if (field.type === 'checkbox') return Boolean(field.defaultValue);
      return '';
    }
    if (field.type === 'multitag' && Array.isArray(value)) {
      return value.join(', ');
    }
    if (field.type === 'checkbox') return Boolean(value);
    return value;
  };

  const initializeForm = (row = null) => {
    const initial = {};

    (config.fields || []).forEach((field) => {
      if (row) {
        initial[field.name] = toInputValue(field, row[field.name]);
      } else if (field.defaultValue !== undefined) {
        initial[field.name] = field.defaultValue;
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
      if (field.type !== 'select') continue;
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
      
      // Handle both response structures: { data: [...], meta: ... } and { success, data: [...], meta: ... }
      const rows = response.data?.data || response.data || [];
      const meta = response.data?.meta || { page: 1, limit: query.limit, total: 0, totalPages: 1 };
      
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

  const openEdit = (row) => {
    initializeForm(row);
    loadFieldOptions();
    setModal({ open: true, mode: 'edit', row });
  };

  const closeModal = () => {
    setModal({ open: false, mode: 'create', row: null });
  };

  const buildPayload = () => {
    const payload = {};
    visibleFields.forEach((field) => {
      let value = formValues[field.name];

      if (field.type === 'checkbox') {
        value = Boolean(value);
      } else if (field.type === 'number') {
        value = value === '' ? null : Number(value);
      } else if (field.type === 'multitag') {
        value = normalizeArray(value);
      } else if (value === '') {
        value = field.required ? '' : null;
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

  const renderField = (field) => {
    const value = formValues[field.name];

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
        <label className="master-form__field" key={field.name}>
          <span>{field.label}</span>
          <textarea
            value={value || ''}
            required={field.required}
            placeholder={field.placeholder}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
          />
        </label>
      );
    }

    if (field.type === 'select') {
      return (
        <label className="master-form__field" key={field.name}>
          <span>{field.label}</span>
          <select
            value={value || ''}
            required={field.required}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
          >
            <option value="">Select</option>
            {(fieldOptions[field.name] || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    return (
      <label className="master-form__field" key={field.name}>
        <span>{field.label}</span>
        <input
          type={field.type || 'text'}
          value={value || ''}
          required={field.required}
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
              Seed Defaults
            </button>
          )}
          <button type="button" className="master-page__primary" onClick={openCreate}>
            + Add
          </button>
        </div>
      </header>

      <div className="master-page__toolbar">
        <input
          className="master-page__search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={`Search ${config.title}`}
        />
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
                      <button type="button" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => handleToggleStatus(row)}>
                        Toggle
                      </button>
                      <button type="button" className="danger" onClick={() => handleDelete(row)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="master-page__pagination">
        <p>
          Showing page {meta.page || 1} of {meta.totalPages || 1} ({meta.total || 0} records)
        </p>
        <div>
          <button
            type="button"
            className="master-page__secondary"
            disabled={!meta.hasPrevPage}
            onClick={() => setQuery((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
          >
            Prev
          </button>
          <button
            type="button"
            className="master-page__secondary"
            disabled={!meta.hasNextPage}
            onClick={() => setQuery((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </button>
        </div>
      </div>

      {modal.open && (
        <div className="master-modal" role="dialog" aria-modal="true">
          <div className="master-modal__panel">
            <header className="master-modal__header">
              <h2>{modal.mode === 'create' ? `Create ${config.title}` : `Edit ${config.title}`}</h2>
              <button type="button" onClick={closeModal}>
                ✕
              </button>
            </header>

            <form className="master-form" onSubmit={handleSubmit}>
              {visibleFields.map(renderField)}

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
    </section>
  );
};

export default MasterCrudPage;
