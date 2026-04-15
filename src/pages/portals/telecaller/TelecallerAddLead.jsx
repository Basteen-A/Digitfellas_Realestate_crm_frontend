import React, { useEffect, useMemo, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';

import { getErrorMessage } from '../../../utils/helpers';
import CalendarPicker from '../../../components/common/CalendarPicker';

const BUDGET_STEPS = [0, 5, 8, 10, 15, 20, 25, 30, 40, 50];
const BUDGET_MAX_VAL = BUDGET_STEPS.length - 1;
const budgetLabel = (idx) => {
  const v = BUDGET_STEPS[idx];
  if (v === 0) return '0';
  if (v >= 50) return '50L+';
  return `${v}L`;
};

const initialForm = {
  full_name: '',
  phone: '',
  whatsappSameAsPhone: true,
  whatsapp_number: '',
  alternate_phone: '',
  email: '',
  lead_source_id: '',
  lead_sub_source_id: '',
  project_ids: [],
  location_id: '',
  location_ids: [],
  budgetMin: '',
  budgetMax: '',
  budgetRange: '',
  budgetMinIdx: 0,
  budgetMaxIdx: BUDGET_MAX_VAL,
  nextFollowUpAt: '',
  lead_status_id: '',
};

const TelecallerAddLead = ({ onNavigate }) => {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [projectOptions, setProjectOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [sourceOptions, setSourceOptions] = useState([]);

  const [statusOptions, setStatusOptions] = useState([]);
  const [subSourceMap, setSubSourceMap] = useState({});
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const locationDropdownRef = useRef(null);
  const [locationSearch, setLocationSearch] = useState('');

  const subSources = useMemo(() => subSourceMap[form.lead_source_id] || [], [subSourceMap, form.lead_source_id]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target)) {
        setProjectDropdownOpen(false); setProjectSearch('');
      }
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(e.target)) {
        setLocationDropdownOpen(false); setLocationSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [pResp, lResp, sResp, wfResp] = await Promise.all([
          projectApi.getDropdown(),
          locationApi.getDropdown(),
          leadSourceApi.getWithSubSources().catch(() => leadSourceApi.getDropdown()),
          leadWorkflowApi.getWorkflowConfig().catch(() => ({ data: null })),
        ]);

        const projects = pResp.data || [];
        const locations = lResp.data || [];
        const sources = sResp.data || [];
        const statuses = wfResp.data?.statuses || [];

        const map = {};
        sources.forEach((source) => { map[source.id] = source.subSources || []; });
        if (Object.values(map).every((items) => items.length === 0)) {
          await Promise.all(
            sources.map(async (source) => {
              try {
                const subResp = await leadSubSourceApi.getBySource(source.id);
                map[source.id] = subResp.data || [];
              } catch {
                map[source.id] = [];
              }
            })
          );
        }

        setProjectOptions(projects);
        setLocationOptions(locations);
        setSourceOptions(sources);
        setStatusOptions(statuses);
        setSubSourceMap(map);
      } catch (error) {
        toast.error(getErrorMessage(error, 'Unable to load lead form options'));
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, []);

  const toggleProject = (projectId) => {
    setForm((prev) => {
      const ids = prev.project_ids.includes(projectId)
        ? prev.project_ids.filter((id) => id !== projectId)
        : [...prev.project_ids, projectId];
      return { ...prev, project_ids: ids };
    });
  };

  const selectedProjectNames = useMemo(
    () => form.project_ids.map((id) => projectOptions.find((p) => p.id === id)?.project_name).filter(Boolean),
    [form.project_ids, projectOptions]
  );

  const toggleLocation = (locId) => {
    setForm((prev) => {
      const ids = (prev.location_ids || []).includes(locId)
        ? prev.location_ids.filter((id) => id !== locId)
        : [...(prev.location_ids || []), locId];
      return { ...prev, location_ids: ids, location_id: ids[0] || '' };
    });
  };

  const selectedLocationNames = useMemo(
    () => (form.location_ids || []).map((id) => {
      const l = locationOptions.find((loc) => loc.id === id);
      return l ? `${l.location_name}${l.city ? ', ' + l.city : ''}` : null;
    }).filter(Boolean),
    [form.location_ids, locationOptions]
  );

  const filteredProjectOptions = useMemo(() => {
    if (!projectSearch.trim()) return projectOptions;
    const s = projectSearch.toLowerCase();
    return projectOptions.filter((p) => (p.project_name || '').toLowerCase().includes(s) || (p.project_code || '').toLowerCase().includes(s));
  }, [projectOptions, projectSearch]);

  const filteredLocationOptions = useMemo(() => {
    if (!locationSearch.trim()) return locationOptions;
    const s = locationSearch.toLowerCase();
    return locationOptions.filter((l) => (l.location_name || '').toLowerCase().includes(s) || (l.city || '').toLowerCase().includes(s));
  }, [locationOptions, locationSearch]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.full_name || !form.phone) {
      toast.error('Full name and phone are required');
      return;
    }
    if (!form.lead_source_id) {
      toast.error('Lead source is required');
      return;
    }
    if (!form.lead_sub_source_id) {
      toast.error('Lead sub-source is required');
      return;
    }
    if (!form.nextFollowUpAt) {
      toast.error('Next follow up date is required');
      return;
    }
    if (!form.lead_status_id) {
      toast.error('Lead status is required');
      return;
    }

    const budgetMin = form.budgetMin ? Number(form.budgetMin) : null;
    const budgetMax = form.budgetMax ? Number(form.budgetMax) : null;
    if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
      toast.error('Budget Max must be greater than or equal to Budget Min');
      return;
    }

    const selectedSource = sourceOptions.find((source) => source.id === form.lead_source_id) || null;
    const selectedLocation = locationOptions.find((location) => location.id === form.location_id) || null;
    // Use first selected project as primary project_id
    const primaryProjectId = form.project_ids[0] || null;
    const selectedProject = primaryProjectId ? projectOptions.find((p) => p.id === primaryProjectId) : null;

    try {
      setSaving(true);
      await leadWorkflowApi.createLead({
        ...form,
        budgetMin,
        budgetMax,
        budgetRange: `${budgetLabel(form.budgetMinIdx || 0)} - ${budgetLabel(form.budgetMaxIdx ?? BUDGET_MAX_VAL)}`,
        whatsapp_number: form.whatsappSameAsPhone ? form.phone : form.whatsapp_number,
        lead_source_id: form.lead_source_id || null,
        lead_sub_source_id: form.lead_sub_source_id || null,
        project_id: primaryProjectId,
        project_ids: form.project_ids,
        location_id: form.location_ids?.[0] || form.location_id || null,
        location_ids: form.location_ids?.length ? form.location_ids : undefined,
        source: selectedSource?.source_name || null,
        project: selectedProject?.project_name || null,
        location: selectedLocation
          ? `${selectedLocation.location_name}${selectedLocation.city ? `, ${selectedLocation.city}` : ''}`
          : null,
        nextFollowUpAt: form.nextFollowUpAt ? new Date(form.nextFollowUpAt).toISOString() : null,
        lead_status_id: form.lead_status_id || null,
      });

      toast.success('Lead created successfully');
      setForm(initialForm);
      onNavigate?.('leads');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Unable to create lead'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header flex-col md:flex-row md:items-center gap-3">
        <div className="page-header-left">
          <h1>Add New Lead</h1>
          <p className="hidden sm:block">Enter buyer details to create a new lead</p>
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-body">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ alignItems: 'start' }}>
              <div className="md:col-span-2">
                <label className="crm-form-label">Full Name *</label>
                <input className="crm-form-input" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} required placeholder="Enter buyer full name" />
              </div>
              
              <div className="crm-form-group">
                <label className="crm-form-label">Phone Number *</label>
                <input className="crm-form-input" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required placeholder="Primary contact number" />
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">WhatsApp Details</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={form.whatsappSameAsPhone} 
                      onChange={(e) => setForm((p) => ({ ...p, whatsappSameAsPhone: e.target.checked, whatsapp_number: e.target.checked ? '' : p.whatsapp_number }))} 
                    />
                    WhatsApp same as phone
                  </label>
                  {!form.whatsappSameAsPhone && (
                    <input 
                      className="crm-form-input" 
                      value={form.whatsapp_number} 
                      onChange={(e) => setForm((p) => ({ ...p, whatsapp_number: e.target.value }))} 
                      placeholder="Enter WhatsApp number"
                    />
                  )}
                </div>
              </div>

              <div className="crm-form-group"><label className="crm-form-label">Alternate Phone (Optional)</label><input className="crm-form-input" value={form.alternate_phone} onChange={(e) => setForm((p) => ({ ...p, alternate_phone: e.target.value }))} placeholder="Secondary contact number" /></div>
              <div className="crm-form-group"><label className="crm-form-label">Email (Optional)</label><input className="crm-form-input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@example.com" /></div>



              <div className="crm-form-group">
                <label className="crm-form-label">Lead Status *</label>
                <select className="crm-form-select" value={form.lead_status_id} onChange={(e) => setForm((p) => ({ ...p, lead_status_id: e.target.value }))} required style={{ borderColor: !form.lead_status_id ? '#fca5a5' : undefined }}>
                  <option value="">Select lead status</option>
                  {statusOptions.map((item) => <option key={item.status_code || item.id} value={item.status_code || item.id}>{item.status_name || item.label}</option>)}
                </select>
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">Lead Source *</label>
                <select className="crm-form-select" value={form.lead_source_id} onChange={(e) => setForm((p) => ({ ...p, lead_source_id: e.target.value, lead_sub_source_id: '' }))} required>
                  <option value="">Select source</option>
                  {sourceOptions.map((item) => <option key={item.id} value={item.id}>{item.source_name}</option>)}
                </select>
              </div>
              <div className="crm-form-group">
                <label className="crm-form-label">Lead Sub-Source *</label>
                <select className="crm-form-select" value={form.lead_sub_source_id} onChange={(e) => setForm((p) => ({ ...p, lead_sub_source_id: e.target.value }))} disabled={!form.lead_source_id || !subSources.length} required style={{ borderColor: form.lead_source_id && !form.lead_sub_source_id ? '#fca5a5' : undefined }}>
                  <option value="">Select sub-source</option>
                  {subSources.map((item) => <option key={item.id} value={item.id}>{item.sub_source_name}</option>)}
                </select>
              </div>

              {/* Searchable Multi-Select Project */}
              <div className="crm-form-group" ref={projectDropdownRef} style={{ position: 'relative' }}>
                <label className="crm-form-label">Project (Multi-Select)</label>
                <div
                  className="crm-form-select"
                  onClick={() => setProjectDropdownOpen((p) => !p)}
                  style={{ cursor: 'pointer', minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 8px' }}
                >
                  {selectedProjectNames.length === 0 && <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 13 }}>Select projects...</span>}
                  {selectedProjectNames.map((name, i) => (
                    <span key={i} style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {name}
                      <span onClick={(e) => { e.stopPropagation(); toggleProject(form.project_ids[i]); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</span>
                    </span>
                  ))}
                </div>
                {projectDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 240, marginTop: 4 }}>
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                      <input type="text" placeholder="Search projects..." value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #0f172a)' }} />
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {filteredProjectOptions.map((project) => (
                        <label key={project.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-primary, #f1f5f9)', color: 'var(--text-primary, #0f172a)' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <input type="checkbox" checked={form.project_ids.includes(project.id)} onChange={() => toggleProject(project.id)} />
                          {project.project_name}{project.project_code ? ` (${project.project_code})` : ''}
                        </label>
                      ))}
                      {filteredProjectOptions.length === 0 && <div style={{ padding: '12px', color: 'var(--text-secondary, #94a3b8)', fontSize: 13, textAlign: 'center' }}>No projects found</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* Searchable Multi-Select Location */}
              <div className="crm-form-group" ref={locationDropdownRef} style={{ position: 'relative' }}>
                <label className="crm-form-label">Location (Multi-Select)</label>
                <div
                  className="crm-form-select"
                  onClick={() => setLocationDropdownOpen((p) => !p)}
                  style={{ cursor: 'pointer', minHeight: 38, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, padding: '4px 8px' }}
                >
                  {selectedLocationNames.length === 0 && <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 13 }}>Select locations...</span>}
                  {selectedLocationNames.map((name, i) => (
                    <span key={i} style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {name}
                      <span onClick={(e) => { e.stopPropagation(); toggleLocation((form.location_ids || [])[i]); }} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</span>
                    </span>
                  ))}
                </div>
                {locationDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-card, #fff)', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: 240, marginTop: 4 }}>
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>
                      <input type="text" placeholder="Search locations..." value={locationSearch} onChange={(e) => setLocationSearch(e.target.value)} onClick={(e) => e.stopPropagation()} style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border-primary, #e2e8f0)', borderRadius: 6, fontSize: 12, outline: 'none', background: 'var(--bg-primary, #fff)', color: 'var(--text-primary, #0f172a)' }} />
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {filteredLocationOptions.map((loc) => (
                        <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-primary, #f1f5f9)', color: 'var(--text-primary, #0f172a)' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <input type="checkbox" checked={(form.location_ids || []).includes(loc.id)} onChange={() => toggleLocation(loc.id)} />
                          {loc.location_name}{loc.city ? `, ${loc.city}` : ''}{loc.state ? ` (${loc.state})` : ''}
                        </label>
                      ))}
                      {filteredLocationOptions.length === 0 && <div style={{ padding: '12px', color: 'var(--text-secondary, #94a3b8)', fontSize: 13, textAlign: 'center' }}>No locations found</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* Budget Range Slider */}
              <div className="crm-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="crm-form-label">Budget Range: <strong>{budgetLabel(form.budgetMinIdx || 0)} – {budgetLabel(form.budgetMaxIdx || BUDGET_MAX_VAL)}</strong></label>
                <div style={{ position: 'relative', height: 40, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                  <div style={{ position: 'absolute', left: 8, right: 8, height: 6, borderRadius: 3, background: 'var(--border-primary, #e2e8f0)' }} />
                  <div style={{ position: 'absolute', left: `calc(${((form.budgetMinIdx || 0) / BUDGET_MAX_VAL) * 100}% + 8px)`, right: `calc(${(1 - (form.budgetMaxIdx ?? BUDGET_MAX_VAL) / BUDGET_MAX_VAL) * 100}% + 8px)`, height: 6, borderRadius: 3, background: 'var(--accent-blue, #3b82f6)' }} />
                  <input type="range" min={0} max={BUDGET_MAX_VAL} value={form.budgetMinIdx || 0}
                    onChange={(e) => {
                      const v = Math.min(Number(e.target.value), (form.budgetMaxIdx ?? BUDGET_MAX_VAL) - 1);
                      setForm((p) => ({ ...p, budgetMinIdx: v, budgetMin: BUDGET_STEPS[v] * 100000, budgetRange: `${budgetLabel(v)} - ${budgetLabel(p.budgetMaxIdx ?? BUDGET_MAX_VAL)}` }));
                    }}
                    style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: 40, opacity: 0, cursor: 'pointer', zIndex: 3 }}
                  />
                  <input type="range" min={0} max={BUDGET_MAX_VAL} value={form.budgetMaxIdx ?? BUDGET_MAX_VAL}
                    onChange={(e) => {
                      const v = Math.max(Number(e.target.value), (form.budgetMinIdx || 0) + 1);
                      setForm((p) => ({ ...p, budgetMaxIdx: v, budgetMax: BUDGET_STEPS[v] * 100000, budgetRange: `${budgetLabel(p.budgetMinIdx || 0)} - ${budgetLabel(v)}` }));
                    }}
                    style={{ position: 'absolute', left: 0, right: 0, width: '100%', height: 40, opacity: 0, cursor: 'pointer', zIndex: 4 }}
                  />
                  {/* Thumb indicators */}
                  <div style={{ position: 'absolute', left: `calc(${((form.budgetMinIdx || 0) / BUDGET_MAX_VAL) * 100}%)`, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-blue, #3b82f6)', border: '3px solid var(--bg-card, #fff)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', zIndex: 5, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', left: `calc(${((form.budgetMaxIdx ?? BUDGET_MAX_VAL) / BUDGET_MAX_VAL) * 100}%)`, transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-blue, #3b82f6)', border: '3px solid var(--bg-card, #fff)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', zIndex: 5, pointerEvents: 'none' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary, #94a3b8)', padding: '0 8px' }}>
                  {BUDGET_STEPS.filter((_, i) => i % 2 === 0).map((v) => <span key={v}>{v >= 50 ? '50L+' : `${v}L`}</span>)}
                </div>
              </div>



              {/* Next Follow Up Date — CalendarPicker */}
              <div className="crm-form-group">
                <label className="crm-form-label">Next Follow Up Date *</label>
                <CalendarPicker
                  type="datetime"
                  value={form.nextFollowUpAt}
                  onChange={(val) => setForm((p) => ({ ...p, nextFollowUpAt: val }))}
                  placeholder="Select Date & Time..."
                  minDate={new Date().toISOString()}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button type="button" className="crm-btn crm-btn-ghost" onClick={() => onNavigate?.('leads')}>
                Cancel
              </button>
              <button type="submit" className="crm-btn crm-btn-primary" disabled={saving || loadingOptions}>
                {saving ? 'Saving...' : loadingOptions ? 'Loading...' : 'Save Lead'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TelecallerAddLead;
