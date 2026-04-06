import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import leadWorkflowApi from '../../../api/leadWorkflowApi';
import projectApi from '../../../api/projectApi';
import locationApi from '../../../api/locationApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import leadTypeApi from '../../../api/leadTypeApi';
import customerTypeApi from '../../../api/customerTypeApi';
import { getErrorMessage } from '../../../utils/helpers';

const initialForm = {
  full_name: '',
  phone: '',
  whatsappSameAsPhone: true,
  whatsapp_number: '',
  alternate_phone: '',
  email: '',
  lead_type_id: '',
  customer_type_id: '',
  lead_source_id: '',
  lead_sub_source_id: '',
  project_id: '',
  location_id: '',
  configuration: '',
  budgetMin: '',
  budgetMax: '',
  note: '',
};

const TelecallerAddLead = ({ onNavigate }) => {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [projectOptions, setProjectOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [leadTypeOptions, setLeadTypeOptions] = useState([]);
  const [customerTypeOptions, setCustomerTypeOptions] = useState([]);
  const [subSourceMap, setSubSourceMap] = useState({});

  const subSources = useMemo(() => subSourceMap[form.lead_source_id] || [], [subSourceMap, form.lead_source_id]);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [pResp, lResp, sResp, ltResp, ctResp] = await Promise.all([
          projectApi.getDropdown(),
          locationApi.getDropdown(),
          leadSourceApi.getWithSubSources().catch(() => leadSourceApi.getDropdown()),
          leadTypeApi.getDropdown().catch(() => ({ data: [] })),
          customerTypeApi.getDropdown().catch(() => ({ data: [] })),
        ]);

        const projects = pResp.data || [];
        const locations = lResp.data || [];
        const sources = sResp.data || [];
        const leadTypes = ltResp.data || [];
        const customerTypes = ctResp.data || [];

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
        setLeadTypeOptions(leadTypes);
        setCustomerTypeOptions(customerTypes);
        setSubSourceMap(map);
      } catch (error) {
        toast.error(getErrorMessage(error, 'Unable to load lead form options'));
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, []);

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

    const budgetMin = form.budgetMin ? Number(form.budgetMin) : null;
    const budgetMax = form.budgetMax ? Number(form.budgetMax) : null;
    if (budgetMin !== null && budgetMax !== null && budgetMax < budgetMin) {
      toast.error('Budget Max must be greater than or equal to Budget Min');
      return;
    }

    const selectedProject = projectOptions.find((project) => project.id === form.project_id) || null;
    const selectedSource = sourceOptions.find((source) => source.id === form.lead_source_id) || null;
    const selectedLocation = locationOptions.find((location) => location.id === form.location_id) || null;

    try {
      setSaving(true);
      await leadWorkflowApi.createLead({
        ...form,
        budgetMin,
        budgetMax,
        whatsapp_number: form.whatsappSameAsPhone ? form.phone : form.whatsapp_number,
        lead_source_id: form.lead_source_id || null,
        lead_sub_source_id: form.lead_sub_source_id || null,
        project_id: form.project_id || null,
        location_id: form.location_id || null,
        source: selectedSource?.source_name || null,
        project: selectedProject?.project_name || null,
        location: selectedLocation
          ? `${selectedLocation.location_name}${selectedLocation.city ? `, ${selectedLocation.city}` : ''}`
          : null,
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
      <div className="page-header">
        <div className="page-header-left">
          <h1>Add New Lead</h1>
          <p>Enter buyer details to create a new lead</p>
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-card-body">
          <form onSubmit={handleSubmit}>
            <div className="crm-grid crm-grid-2" style={{ gap: 14 }}>
              <div className="crm-form-group" style={{ gridColumn: 'span 2' }}>
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

              <div className="crm-form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="crm-form-label">Lead Type</label>
                  <select className="crm-form-select" value={form.lead_type_id} onChange={(e) => setForm((p) => ({ ...p, lead_type_id: e.target.value }))}>
                    <option value="">Select lead type</option>
                    {leadTypeOptions.map((item) => <option key={item.id} value={item.id}>{item.type_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="crm-form-label">Customer Type</label>
                  <select className="crm-form-select" value={form.customer_type_id} onChange={(e) => setForm((p) => ({ ...p, customer_type_id: e.target.value }))}>
                    <option value="">Select customer type</option>
                    {customerTypeOptions.map((item) => <option key={item.id} value={item.id}>{item.type_name}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="crm-form-group">
                <label className="crm-form-label">Lead Source *</label>
                <select className="crm-form-select" value={form.lead_source_id} onChange={(e) => setForm((p) => ({ ...p, lead_source_id: e.target.value, lead_sub_source_id: '' }))} required>
                  <option value="">Select source</option>
                  {sourceOptions.map((item) => <option key={item.id} value={item.id}>{item.source_name}</option>)}
                </select>
              </div>
              <div className="crm-form-group">
                <label className="crm-form-label">Lead Sub-Source</label>
                <select className="crm-form-select" value={form.lead_sub_source_id} onChange={(e) => setForm((p) => ({ ...p, lead_sub_source_id: e.target.value }))} disabled={!form.lead_source_id || !subSources.length}>
                  <option value="">Select sub-source</option>
                  {subSources.map((item) => <option key={item.id} value={item.id}>{item.sub_source_name}</option>)}
                </select>
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">Project</label>
                <select
                  className="crm-form-select"
                  value={form.project_id}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selectedProject = projectOptions.find((project) => project.id === selectedId) || null;
                    setForm((prev) => ({ ...prev, project_id: selectedId, location_id: selectedProject?.location_id || prev.location_id }));
                  }}
                >
                  <option value="">Select project</option>
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>{project.project_name}{project.project_code ? ` (${project.project_code})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="crm-form-group">
                <label className="crm-form-label">Location</label>
                <select className="crm-form-select" value={form.location_id} onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))}>
                  <option value="">Select location</option>
                  {locationOptions.map((location) => (
                    <option key={location.id} value={location.id}>{location.location_name}{location.city ? `, ${location.city}` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">Configuration (Optional)</label>
                <select className="crm-form-select" value={form.configuration} onChange={(e) => setForm((p) => ({ ...p, configuration: e.target.value }))}>
                  <option value="">Select configuration</option>
                  <option value="1BHK">1BHK</option>
                  <option value="2BHK">2BHK</option>
                  <option value="3BHK">3BHK</option>
                  <option value="4BHK">4BHK</option>
                  <option value="Villa">Villa</option>
                  <option value="Plot">Plot</option>
                </select>
              </div>

              <div className="crm-form-group"><label className="crm-form-label">Budget Min</label><input className="crm-form-input" type="number" value={form.budgetMin} onChange={(e) => setForm((p) => ({ ...p, budgetMin: e.target.value }))} /></div>
              <div className="crm-form-group"><label className="crm-form-label">Budget Max</label><input className="crm-form-input" type="number" value={form.budgetMax} onChange={(e) => setForm((p) => ({ ...p, budgetMax: e.target.value }))} /></div>
              <div className="crm-form-group">
                <label className="crm-form-label">Budget Range</label>
                <select className="crm-form-select" value={form.budgetRange} onChange={(e) => setForm((p) => ({ ...p, budgetRange: e.target.value }))}>
                  <option value="">Select range</option>
                  <option value="Below 8L">Below 8 Lakhs</option>
                  <option value="8-15L">8 - 15 Lakhs</option>
                  <option value="15-25L">15 - 25 Lakhs</option>
                  <option value="Above 25L">Above 25 Lakhs</option>
                </select>
              </div>
              <div className="crm-form-group">
                <label className="crm-form-label">Priority</label>
                <select className="crm-form-select" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">Urgent</option>
                </select>
              </div>

              {/* <div className="crm-form-group"><label className="crm-form-label">Campaign Name</label><input className="crm-form-input" value={form.campaign_name} onChange={(e) => setForm((p) => ({ ...p, campaign_name: e.target.value }))} /></div>
              <div className="crm-form-group"><label className="crm-form-label">UTM Source</label><input className="crm-form-input" value={form.utm_source} onChange={(e) => setForm((p) => ({ ...p, utm_source: e.target.value }))} /></div>
              <div className="crm-form-group"><label className="crm-form-label">UTM Medium</label><input className="crm-form-input" value={form.utm_medium} onChange={(e) => setForm((p) => ({ ...p, utm_medium: e.target.value }))} /></div>
              <div className="crm-form-group"><label className="crm-form-label">UTM Campaign</label><input className="crm-form-input" value={form.utm_campaign} onChange={(e) => setForm((p) => ({ ...p, utm_campaign: e.target.value }))} /></div>
              <div className="crm-form-group"><label className="crm-form-label">Referral Code</label><input className="crm-form-input" value={form.referral_code} onChange={(e) => setForm((p) => ({ ...p, referral_code: e.target.value }))} /></div> */}
            </div>

            <div className="crm-form-group" style={{ marginTop: 10 }}>
              <label className="crm-form-label">Initial Notes</label>
              <textarea className="crm-form-input" rows={3} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Initial notes about the lead" />
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
