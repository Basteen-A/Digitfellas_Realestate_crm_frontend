// ============================================================
// ROLES & PERMISSIONS  (/super-admin/user-types)
//
// Create a role and configure, module by module, what it can reach:
//   None → Read → Write → Full Access
//
// The matrix is stored on the ROLE (user_types.module_permissions) and enforced
// server-side by middleware/requirePermission.js. Everything drawn here is a
// convenience — hiding a control never protects the endpoint behind it.
//
// Built-in roles (is_system) can have their permissions tuned but not their
// short code changed or the role deleted, because every bespoke portal and a
// pile of legacy checks switch on that code. Super Admin is not editable at all.
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ShieldCheckIcon, PlusIcon, ArrowPathIcon, TrashIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';
import userTypeApi from '../../../api/userTypeApi';
import { getErrorMessage } from '../../../utils/helpers';
import {
  MODULES as FALLBACK_MODULES, MODULE_GROUPS as FALLBACK_GROUPS, sanitizeMatrix,
} from '../../../config/modules';
import './RolePermissions.css';

const LEVEL_LABELS = { none: 'None', read: 'Read', write: 'Write', full: 'Full Access' };
const ORDER = ['none', 'read', 'write', 'full'];

const blankRole = () => ({
  id: null,
  type_name: '',
  short_code: '',
  description: '',
  hierarchy_level: 50,
  is_active: true,
  is_system: false,
  module_permissions: {},
});

const RolePermissionsPage = () => {
  const [roles, setRoles] = useState([]);
  const [catalogue, setCatalogue] = useState({ modules: FALLBACK_MODULES, groups: FALLBACK_GROUPS });
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isNew = draft && !draft.id;
  const isSuperAdmin = draft && String(draft.short_code).toUpperCase() === 'SA';

  const load = useCallback(async (keepId = null) => {
    setLoading(true);
    try {
      const [listResp, catResp] = await Promise.all([
        userTypeApi.getAll({ limit: 100, sort: 'hierarchy_level' }),
        userTypeApi.getModuleCatalogue().catch(() => null), // fall back to the bundled copy
      ]);
      const rows = listResp.data || [];
      setRoles(rows);
      if (catResp?.data?.modules?.length) {
        setCatalogue({ modules: catResp.data.modules, groups: catResp.data.groups });
      }
      const next = keepId ? rows.find((r) => r.id === keepId) : rows[0];
      if (next) {
        setSelectedId(next.id);
        setDraft({ ...next, module_permissions: next.module_permissions || {} });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load roles'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectRole = (role) => {
    setSelectedId(role.id);
    setDraft({ ...role, module_permissions: role.module_permissions || {} });
  };

  const startNew = () => {
    setSelectedId(null);
    setDraft(blankRole());
  };

  const setLevel = (moduleKey, level) =>
    setDraft((d) => ({ ...d, module_permissions: { ...d.module_permissions, [moduleKey]: level } }));

  // Bulk helpers — "give this role read on everything it can read", etc.
  const setAll = (level) =>
    setDraft((d) => {
      const next = {};
      catalogue.modules.forEach((m) => {
        // Clamp to the highest level this module actually offers.
        const allowed = m.levels.filter((l) => ORDER.indexOf(l) <= ORDER.indexOf(level));
        next[m.key] = allowed[allowed.length - 1] || 'none';
      });
      return { ...d, module_permissions: next };
    });

  const grantedCount = useMemo(() => {
    if (!draft) return 0;
    return Object.values(draft.module_permissions || {}).filter((v) => v && v !== 'none').length;
  }, [draft]);

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.type_name?.trim()) { toast.error('Role name is required'); return; }
    if (!draft.short_code?.trim()) { toast.error('Short code is required'); return; }

    setSaving(true);
    try {
      const payload = {
        type_name: draft.type_name.trim(),
        short_code: draft.short_code.trim().toUpperCase(),
        description: draft.description || '',
        hierarchy_level: Number(draft.hierarchy_level) || 0,
        is_active: draft.is_active !== false,
      };
      // Super Admin's matrix is rejected server-side — never send it.
      if (!isSuperAdmin) payload.module_permissions = sanitizeMatrix(draft.module_permissions || {});
      // A built-in role's short code is load-bearing; the server rejects a change.
      if (draft.is_system) delete payload.short_code;

      if (isNew) {
        const resp = await userTypeApi.create(payload);
        toast.success('Role created');
        await load(resp.data?.id || null);
      } else {
        await userTypeApi.update(draft.id, payload);
        toast.success('Permissions saved');
        await load(draft.id);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save role'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft?.id || draft.is_system) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete the role "${draft.type_name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await userTypeApi.remove(draft.id);
      toast.success('Role deleted');
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete role'));
    } finally {
      setSaving(false);
    }
  };

  const modulesByGroup = useMemo(() => {
    const map = {};
    catalogue.modules.forEach((m) => {
      (map[m.group] = map[m.group] || []).push(m);
    });
    return map;
  }, [catalogue]);

  return (
    <div className="master-page rp-page">
      <div className="master-page__header">
        <div>
          <h1>
            <ShieldCheckIcon style={{ width: 22, height: 22, marginRight: 6, verticalAlign: 'text-bottom' }} />
            Roles &amp; Permissions
          </h1>
          <p>Create a role, then choose what each module it can reach — none, read, write or full access.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="crm-btn crm-btn-ghost" onClick={() => load(selectedId)} disabled={loading}>
            <ArrowPathIcon style={{ width: 16, height: 16 }} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className="crm-btn crm-btn-primary" onClick={startNew}>
            <PlusIcon style={{ width: 16, height: 16 }} /> New Role
          </button>
        </div>
      </div>

      <div className="rp-layout">
        {/* ── Role list ── */}
        <aside className="rp-list">
          <div className="rp-list__head">
            <span className="rp-list__title">Roles</span>
            <span className="rp-list__title">{roles.length}</span>
          </div>
          <div className="rp-list__body">
            {roles.map((role) => {
              const granted = Object.values(role.module_permissions || {}).filter((v) => v && v !== 'none').length;
              return (
                <button
                  key={role.id}
                  type="button"
                  className={`rp-role ${role.id === selectedId ? 'is-active' : ''} ${role.is_active === false ? 'is-inactive' : ''}`}
                  onClick={() => selectRole(role)}
                >
                  <div className="rp-role__name">
                    {role.type_name}
                    {role.is_system
                      ? <span className="rp-chip rp-chip--system">Built-in</span>
                      : <span className="rp-chip rp-chip--custom">Custom</span>}
                    {role.is_active === false && <span className="rp-chip rp-chip--off">Inactive</span>}
                  </div>
                  <div className="rp-role__meta">
                    {role.short_code} · {granted} module{granted === 1 ? '' : 's'}
                  </div>
                </button>
              );
            })}
            {!loading && roles.length === 0 && <div className="rp-empty">No roles yet.</div>}
          </div>
        </aside>

        {/* ── Editor ── */}
        <section className="rp-editor">
          {!draft ? (
            <div className="rp-empty">{loading ? 'Loading…' : 'Select a role, or create a new one.'}</div>
          ) : (
            <>
              <div className="rp-editor__head">
                <div>
                  <div className="rp-editor__title">
                    {isNew ? 'New role' : draft.type_name}
                    {draft.is_system && (
                      <LockClosedIcon style={{ width: 15, height: 15, marginLeft: 6, verticalAlign: 'text-bottom', opacity: .5 }} />
                    )}
                  </div>
                  <div className="rp-editor__sub">
                    {isSuperAdmin
                      ? 'Super Admin always has full access — its permissions cannot be edited.'
                      : `${grantedCount} of ${catalogue.modules.length} modules granted`}
                  </div>
                </div>
              </div>

              <div className="rp-editor__body">
                {isSuperAdmin && (
                  <div className="rp-banner">
                    <span>
                      Super Admin bypasses the permission system entirely so the platform can never be
                      locked out. Edit a different role to change what it can reach.
                    </span>
                  </div>
                )}
                {draft.is_system && !isSuperAdmin && (
                  <div className="rp-banner">
                    <span>
                      This is a built-in role. Its permissions are editable, but the short code
                      (<strong>{draft.short_code}</strong>) is fixed — the app&rsquo;s portals and screens are
                      wired to it — and the role cannot be deleted.
                    </span>
                  </div>
                )}

                {/* Identity */}
                <div className="rp-fields">
                  <div className="rp-field">
                    <label htmlFor="rp-name">Role name</label>
                    <input
                      id="rp-name" type="text" value={draft.type_name}
                      placeholder="e.g. Audit Manager"
                      onChange={(e) => setDraft((d) => ({ ...d, type_name: e.target.value }))}
                    />
                  </div>
                  <div className="rp-field">
                    <label htmlFor="rp-code">Short code</label>
                    <input
                      id="rp-code" type="text" value={draft.short_code} maxLength={10}
                      placeholder="e.g. AUD" disabled={draft.is_system}
                      onChange={(e) => setDraft((d) => ({ ...d, short_code: e.target.value.toUpperCase() }))}
                    />
                    <div className="rp-field__hint">
                      {draft.is_system ? 'Fixed for built-in roles.' : 'Letters and numbers, up to 10. Cannot be changed later.'}
                    </div>
                  </div>
                  <div className="rp-field">
                    <label htmlFor="rp-hier">Hierarchy level</label>
                    <input
                      id="rp-hier" type="number" min={0} max={99} value={draft.hierarchy_level ?? 0}
                      onChange={(e) => setDraft((d) => ({ ...d, hierarchy_level: e.target.value }))}
                    />
                    <div className="rp-field__hint">Lower = more senior. 1 is Super Admin.</div>
                  </div>
                  <div className="rp-field">
                    <label htmlFor="rp-desc">Description</label>
                    <input
                      id="rp-desc" type="text" value={draft.description || ''}
                      placeholder="What is this role for?"
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Bulk actions */}
                {!isSuperAdmin && (
                  <div className="rp-bulk">
                    <span className="rp-bulk__label">Set every module to:</span>
                    {ORDER.map((lvl) => (
                      <button
                        key={lvl} type="button" className="crm-btn crm-btn-ghost crm-btn-sm"
                        onClick={() => setAll(lvl)}
                      >
                        {LEVEL_LABELS[lvl]}
                      </button>
                    ))}
                  </div>
                )}

                {/* The matrix */}
                {catalogue.groups.map((group) => (
                  <div className="rp-group" key={group}>
                    <div className="rp-group__name">{group}</div>
                    {(modulesByGroup[group] || []).map((mod) => {
                      const current = isSuperAdmin ? 'full' : (draft.module_permissions?.[mod.key] || 'none');
                      return (
                        <div className="rp-row" key={mod.key}>
                          <div>
                            <div className="rp-row__label">{mod.label}</div>
                            {mod.description && <div className="rp-row__desc">{mod.description}</div>}
                          </div>
                          <div className="rp-seg" role="group" aria-label={`${mod.label} access level`}>
                            {ORDER.map((lvl) => {
                              const supported = mod.levels.includes(lvl);
                              return (
                                <button
                                  key={lvl}
                                  type="button"
                                  data-level={lvl}
                                  className={`rp-seg__btn ${current === lvl ? 'is-on' : ''}`}
                                  disabled={!supported || isSuperAdmin}
                                  title={supported ? undefined : `${mod.label} has no ${LEVEL_LABELS[lvl]} level`}
                                  onClick={() => setLevel(mod.key, lvl)}
                                >
                                  {LEVEL_LABELS[lvl]}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="rp-editor__foot">
                <div>
                  {!isNew && !draft.is_system && (
                    <button type="button" className="crm-btn crm-btn-ghost" onClick={handleDelete} disabled={saving}>
                      <TrashIcon style={{ width: 15, height: 15 }} /> Delete role
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox" checked={draft.is_active !== false}
                      onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
                    />
                    Active
                  </label>
                  <button type="button" className="crm-btn crm-btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : isNew ? 'Create role' : 'Save changes'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default RolePermissionsPage;
