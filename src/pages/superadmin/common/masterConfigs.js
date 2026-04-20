import locationApi from '../../../api/locationApi';
import projectApi from '../../../api/projectApi';
import projectTypeApi from '../../../api/projectTypeApi';
import leadTypeApi from '../../../api/leadTypeApi';
import leadSourceApi from '../../../api/leadSourceApi';
import leadSubSourceApi from '../../../api/leadSubSourceApi';
import userApi from '../../../api/userApi';
import userTypeApi from '../../../api/userTypeApi';
import customerTypeApi from '../../../api/customerTypeApi';
import scoreMasterApi from '../../../api/scoreMasterApi';
import leadStatusApi from '../../../api/leadStatusApi';
import bookingStatusApi from '../../../api/bookingStatusApi';
import leadStageApi from '../../../api/leadStageApi';
import closedLostReasonApi from '../../../api/closedLostReasonApi';
import bookingCancelReasonApi from '../../../api/bookingCancelReasonApi';
import statusRemarkApi from '../../../api/statusRemarkApi';
import motivationApi from '../../../api/motivationApi';
import api from '../../../api/axiosInstance';

const asOptions = (items, labelBuilder, valueKey = 'id') =>
  (items || []).map((item) => ({
    value: item[valueKey],
    label: labelBuilder(item),
    raw: item,
  }));

const loadLocationOptions = async () => {
  const response = await locationApi.getDropdown();
  return asOptions(response.data, (item) => [item.location_name, item.city].filter(Boolean).join(', '));
};

const loadProjectTypeOptions = async () => {
  const response = await projectTypeApi.getDropdown();
  return asOptions(response.data, (item) => `${item.type_name}${item.short_code ? ` (${item.short_code})` : ''}`);
};

const loadLeadSourceOptions = async () => {
  const response = await leadSourceApi.getDropdown();
  return asOptions(response.data, (item) => item.source_name);
};

const loadUserTypeOptions = async () => {
  const response = await userTypeApi.getDropdown();
  return asOptions(response.data, (item) => `${item.type_name}${item.short_code ? ` (${item.short_code})` : ''}`);
};

const loadLeadStageOptions = async () => {
  const response = await leadStageApi.getDropdown();
  return asOptions(response.data, (item) => `${item.stage_name} (${item.stage_code})`, 'stage_code');
};

const loadLeadStatusOptions = async () => {
  const response = await leadStatusApi.getDropdown();
  return asOptions(response.data, (item) => `${item.status_name} (${item.status_code})`, 'status_code');
};

const loadLeadStatusIdOptions = async () => {
  const response = await leadStatusApi.getDropdown();
  return asOptions(response.data, (item) => `${item.status_name} (${item.status_code})`);
};

const commonSimpleColumns = [
  { header: 'Name', path: 'type_name' },
  { header: 'Code', path: 'short_code' },
  { header: 'Sort', path: 'sort_order' },
  { header: 'Active', path: 'is_active', type: 'boolean' },
];

export const masterConfigs = {
  locations: {
    title: 'Locations',
    api: locationApi,
    columns: [
      { header: 'Location', path: 'location_name' },
      { header: 'City', path: 'city' },
      { header: 'State', path: 'state' },
      { header: 'Pincode', path: 'pincode' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'location_name', label: 'Location Name', required: true },
      { name: 'city', label: 'City' },
      { name: 'state', label: 'State' },
      { name: 'country', label: 'Country' },
      { name: 'pincode', label: 'Pincode' },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  projects: {
    title: 'Projects',
    api: projectApi,
    columns: [
      { header: 'Project', path: 'project_name' },
      { header: 'Code', path: 'project_code' },
      { header: 'Type', path: 'projectType.type_name' },
      { header: 'Location', path: 'location.location_name' },
      { header: 'Featured', path: 'is_featured', type: 'boolean' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'project_name', label: 'Project Name', required: true },
      { name: 'project_code', label: 'Project Code' },
      {
        name: 'project_type_id',
        label: 'Project Type',
        type: 'select',
        required: true,
        loadOptions: loadProjectTypeOptions,
      },
      {
        name: 'location_id',
        label: 'Location',
        type: 'select',
        required: true,
        loadOptions: loadLocationOptions,
      },
      { name: 'builder_name', label: 'Builder Name' },
      { name: 'rera_number', label: 'RERA Number' },
      { name: 'total_units', label: 'Total Units', type: 'number' },
      { name: 'available_units', label: 'Available Units', type: 'number' },
      { name: 'price_range_min', label: 'Price Min', type: 'number' },
      { name: 'price_range_max', label: 'Price Max', type: 'number' },
      { name: 'configurations', label: 'Configurations', type: 'multitag', placeholder: 'e.g. 1BHK, 2BHK' },
      { name: 'amenities', label: 'Amenities', type: 'multitag', placeholder: 'e.g. Clubhouse, Security' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_featured', label: 'Featured', type: 'checkbox' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  projectTypes: {
    title: 'Project Types',
    api: projectTypeApi,
    columns: commonSimpleColumns,
    fields: [
      { name: 'type_name', label: 'Type Name', required: true },
      { name: 'short_code', label: 'Short Code' },
      { name: 'icon', label: 'Icon' },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  leadTypes: {
    title: 'Lead Types',
    api: leadTypeApi,
    columns: commonSimpleColumns,
    fields: [
      { name: 'type_name', label: 'Type Name', required: true },
      { name: 'short_code', label: 'Short Code' },
      { name: 'color_code', label: 'Color', type: 'color' },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  leadSources: {
    title: 'Lead Sources',
    api: leadSourceApi,
    columns: [
      { header: 'Source', path: 'source_name' },
      { header: 'Code', path: 'short_code' },
      { header: 'Icon', path: 'icon' },
      { header: 'Sort', path: 'sort_order' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'source_name', label: 'Source Name', required: true },
      { name: 'short_code', label: 'Short Code' },
      { name: 'color_code', label: 'Color', type: 'color' },
      { name: 'icon', label: 'Icon' },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  leadSubSources: {
    title: 'Lead Sub-Sources',
    api: leadSubSourceApi,
    columns: [
      { header: 'Sub-Source', path: 'sub_source_name' },
      { header: 'Lead Source', path: 'leadSource.source_name' },
      { header: 'Code', path: 'short_code' },
      { header: 'Sort', path: 'sort_order' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      {
        name: 'lead_source_id',
        label: 'Lead Source',
        type: 'select',
        required: true,
        loadOptions: loadLeadSourceOptions,
      },
      { name: 'sub_source_name', label: 'Sub-Source Name', required: true },
      { name: 'short_code', label: 'Short Code' },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  users: {
    title: 'Users',
    api: userApi,
    columns: [
      { header: 'Name', path: 'full_name' },
      { header: 'Email', path: 'email' },
      { header: 'Phone', path: 'phone' },
      { header: 'User Type', path: 'userType.type_name' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      {
        name: 'user_type_id',
        label: 'User Type',
        type: 'select',
        required: true,
        loadOptions: loadUserTypeOptions,
      },
      { name: 'employee_id', label: 'Employee ID' },
      { name: 'first_name', label: 'First Name', required: true },
      { name: 'last_name', label: 'Last Name', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true, hideOnEdit: true },
      { name: 'alternate_phone', label: 'Alternate Phone' },
      {
        name: 'location_ids',
        label: 'Project Locations',
        type: 'multiselect',
        loadOptions: loadLocationOptions,
        showWhen: (formValues, optionsMap) => {
          const selectedTypeId = formValues?.user_type_id;
          if (!selectedTypeId) return false;
          const selectedType = (optionsMap?.user_type_id || []).find((opt) => String(opt.value) === String(selectedTypeId));
          const shortCode = String(selectedType?.raw?.short_code || '').toUpperCase();
          return ['TC', 'TELECALLER', 'TELE_CALLER'].includes(shortCode);
        },
        getInitialValue: (row) => {
          const directIds = Array.isArray(row?.location_ids)
            ? row.location_ids
            : Array.isArray(row?.locationIds)
              ? row.locationIds
              : [];

          if (directIds.length > 0) {
            return [...new Set(directIds.filter(Boolean).map((id) => String(id)))];
          }

          const mappings = Array.isArray(row?.locationMappings)
            ? row.locationMappings
            : Array.isArray(row?.location_mappings)
              ? row.location_mappings
              : [];

          return [...new Set(
            mappings
              .map((mapping) => mapping?.location_id || mapping?.location?.id)
              .filter(Boolean)
              .map((id) => String(id))
          )];
        },
      },
      {
        name: 'gender',
        label: 'Gender',
        type: 'select',
        options: [
          { value: 'Male', label: 'Male' },
          { value: 'Female', label: 'Female' },
          { value: 'Other', label: 'Other' },
        ],
      },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  userTypes: {
    title: 'User Types',
    api: userTypeApi,
    columns: [
      { header: 'Type', path: 'type_name' },
      { header: 'Short Code', path: 'short_code' },
      { header: 'Hierarchy', path: 'hierarchy_level' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'type_name', label: 'Type Name', required: true },
      { name: 'short_code', label: 'Short Code', required: true },
      { name: 'hierarchy_level', label: 'Hierarchy Level', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  customerTypes: {
    title: 'Customer Types',
    api: customerTypeApi,
    columns: commonSimpleColumns,
    fields: [
      { name: 'type_name', label: 'Type Name', required: true },
      { name: 'short_code', label: 'Short Code' },
      { name: 'color_code', label: 'Color', type: 'color' },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  scoreMaster: {
    title: 'Score Master',
    api: scoreMasterApi,
    columns: [
      { header: 'Criteria', path: 'criteria_name' },
      { header: 'Key', path: 'criteria_key' },
      { header: 'Category', path: 'category' },
      { header: 'Score', path: 'score_value' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'criteria_name', label: 'Criteria Name', required: true },
      { name: 'criteria_key', label: 'Criteria Key', required: true },
      { name: 'score_value', label: 'Score Value', type: 'number', required: true },
      { name: 'max_score', label: 'Max Score', type: 'number' },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'BUDGET', label: 'BUDGET' },
          { value: 'TIMELINE', label: 'TIMELINE' },
          { value: 'ENGAGEMENT', label: 'ENGAGEMENT' },
          { value: 'PROFILE', label: 'PROFILE' },
          { value: 'CUSTOM', label: 'CUSTOM' },
        ],
      },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  leadStatuses: {
    title: 'Lead Status',
    api: leadStatusApi,
    columns: [
      { header: 'Status', path: 'status_name' },
      { header: 'Code', path: 'status_code' },
      { header: 'Category', path: 'status_category' },
      { header: 'Terminal', path: 'is_terminal', type: 'boolean' },
      { header: 'Sort', path: 'sort_order' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'status_name', label: 'Status Name', required: true },
      { name: 'status_code', label: 'Status Code', required: true },
      { name: 'color_code', label: 'Color', type: 'color' },
      { name: 'text_color', label: 'Text Color', type: 'color' },
      { name: 'icon', label: 'Icon' },
      {
        name: 'status_category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'ACTIVE', label: 'ACTIVE' },
          { value: 'NEGATIVE', label: 'NEGATIVE' },
          { value: 'POSITIVE', label: 'POSITIVE' },
          { value: 'DISQUALIFIED', label: 'DISQUALIFIED' },
        ],
      },
      { name: 'is_terminal', label: 'Terminal Status', type: 'checkbox' },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  bookingStatuses: {
    title: 'Booking Status',
    api: bookingStatusApi,
    columns: [
      { header: 'Status', path: 'status_name' },
      { header: 'Code', path: 'status_code' },
      { header: 'Order', path: 'status_order' },
      { header: 'Terminal', path: 'is_terminal', type: 'boolean' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'status_name', label: 'Status Name', required: true },
      { name: 'status_code', label: 'Status Code', required: true },
      { name: 'color_code', label: 'Color', type: 'color' },
      { name: 'status_order', label: 'Status Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_terminal', label: 'Terminal Status', type: 'checkbox' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  leadStages: {
    title: 'Lead Stage',
    api: leadStageApi,
    columns: [
      { header: 'Stage', path: 'stage_name' },
      { header: 'Code', path: 'stage_code' },
      { header: 'Category', path: 'stage_category' },
      { header: 'Order', path: 'stage_order' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'stage_name', label: 'Stage Name', required: true },
      { name: 'stage_code', label: 'Stage Code', required: true },
      {
        name: 'stage_category',
        label: 'Stage Category',
        type: 'select',
        required: true,
        options: [
          { value: 'INQUIRY', label: 'INQUIRY' },
          { value: 'QUALIFICATION', label: 'QUALIFICATION' },
          { value: 'ENGAGEMENT', label: 'ENGAGEMENT' },
          { value: 'NEGOTIATION', label: 'NEGOTIATION' },
          { value: 'CLOSING', label: 'CLOSING' },
          { value: 'CLOSED', label: 'CLOSED' },
          { value: 'PARKED', label: 'PARKED' },
          { value: 'DISQUALIFIED', label: 'DISQUALIFIED' },
        ],
      },
      { name: 'color_code', label: 'Color', type: 'color' },
      { name: 'icon', label: 'Icon' },
      { name: 'stage_order', label: 'Stage Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_terminal', label: 'Terminal Stage', type: 'checkbox' },
      { name: 'is_positive', label: 'Positive Stage', type: 'checkbox', defaultValue: true },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  closedLostReasons: {
    title: 'Closed-Lost Reasons',
    api: closedLostReasonApi,
    columns: [
      { header: 'Reason', path: 'reason_name' },
      { header: 'Code', path: 'reason_code' },
      { header: 'Category', path: 'category' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'reason_name', label: 'Reason Name', required: true },
      { name: 'reason_code', label: 'Reason Code' },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'BUDGET', label: 'BUDGET' },
          { value: 'COMPETITION', label: 'COMPETITION' },
          { value: 'PRODUCT', label: 'PRODUCT' },
          { value: 'TIMING', label: 'TIMING' },
          { value: 'OTHER', label: 'OTHER' },
          { value: 'COLD', label: 'COLD' },
          { value: 'JUNK', label: 'JUNK' },
          { value: 'SPAM', label: 'SPAM' },
          { value: 'TC_DROP', label: 'TC_DROP' },
          { value: 'SM_DROP', label: 'SM_DROP' },
          { value: 'SH_DROP', label: 'SH_DROP' },
          { value: 'COL_CANCEL', label: 'COL_CANCEL' },
        ],
      },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  bookingCancelReasons: {
    title: 'Booking Cancel Reasons',
    api: bookingCancelReasonApi,
    columns: [
      { header: 'Reason', path: 'reason_name' },
      { header: 'Code', path: 'reason_code' },
      { header: 'Category', path: 'category' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'reason_name', label: 'Reason Name', required: true },
      { name: 'reason_code', label: 'Reason Code' },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: [
          { value: 'FINANCIAL', label: 'FINANCIAL' },
          { value: 'COMPETITION', label: 'COMPETITION' },
          { value: 'PERSONAL', label: 'PERSONAL' },
          { value: 'LEGAL', label: 'LEGAL' },
          { value: 'PRODUCT', label: 'PRODUCT' },
          { value: 'OTHER', label: 'OTHER' },
        ],
      },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  workflowActions: {
    title: 'Workflow Actions',
    api: {
      getAll: async () => {
        const { data } = await api.get('/workflow-actions');
        return data;
      },
      create: async (data) => {
        const { data: result } = await api.post('/workflow-actions', data);
        return result;
      },
      update: async (id, data) => {
        const { data: result } = await api.put(`/workflow-actions/${id}`, data);
        return result;
      },
      delete: async (id) => {
        const { data: result } = await api.delete(`/workflow-actions/${id}`);
        return result;
      },
      seed: async () => {
        const { data } = await api.post('/workflow-actions/seed');
        return data;
      },
    },
    columns: [
      { header: 'ID', path: 'id', width: 60 },
      { header: 'Role', path: 'role', width: 80 },
      { header: 'Code', path: 'code' },
      { header: 'Label', path: 'label' },
      { header: 'Tone', path: 'tone', width: 100 },
      { header: 'Target Stage', path: 'targetStageCode' },
      { header: 'Target Status', path: 'targetStatusCode' },
      { header: 'Active', path: 'isActive', width: 80, type: 'boolean' },
    ],
    fields: [
      {
        name: 'role',
        label: 'Role',
        type: 'select',
        required: true,
        options: [
          { value: 'TC', label: 'Telecaller (TC)' },
          { value: 'SM', label: 'Sales Manager (SM)' },
          { value: 'SH', label: 'Sales Head (SH)' },
          { value: 'COL', label: 'Collection (COL)' },
        ],
      },
      { name: 'code', label: 'Action Code', type: 'text', required: true, placeholder: 'e.g. TC_CONNECTED_INTERESTED' },
      { name: 'label', label: 'Label', type: 'text', required: true, placeholder: 'e.g. Mark Interested' },
      {
        name: 'tone',
        label: 'Tone',
        type: 'select',
        options: [
          { value: 'primary', label: 'Primary (Blue)' },
          { value: 'secondary', label: 'Secondary (Gray)' },
          { value: 'success', label: 'Success (Green)' },
          { value: 'warning', label: 'Warning (Yellow)' },
          { value: 'danger', label: 'Danger (Red)' },
        ],
      },
      { name: 'targetStageCode', label: 'Target Stage', type: 'select', loadOptions: loadLeadStageOptions },
      { name: 'targetStatusCode', label: 'Target Status', type: 'select', loadOptions: loadLeadStatusOptions },
      { name: 'needsFollowUp', label: 'Needs Follow-up', type: 'checkbox' },
      { name: 'needsReason', label: 'Needs Reason', type: 'checkbox' },
      {
        name: 'reasonCategory',
        label: 'Reason Category',
        type: 'select',
        options: [
          { value: 'COLD', label: 'COLD' },
          { value: 'JUNK', label: 'JUNK' },
          { value: 'TC_DROP', label: 'TC_DROP' },
          { value: 'SM_DROP', label: 'SM_DROP' },
          { value: 'SH_DROP', label: 'SH_DROP' },
          { value: 'COL_CANCEL', label: 'COL_CANCEL' },
        ],
      },
      { name: 'needsAssignee', label: 'Needs Assignee', type: 'checkbox' },
      {
        name: 'assigneeRole',
        label: 'Assignee Role',
        type: 'select',
        options: [
          { value: 'TC', label: 'Telecaller (TC)' },
          { value: 'SM', label: 'Sales Manager (SM)' },
          { value: 'SH', label: 'Sales Head (SH)' },
          { value: 'COL', label: 'Collection (COL)' },
        ],
      },
      { name: 'needsSvDetails', label: 'Needs Site Visit Details', type: 'checkbox' },
      { name: 'needsCustomerProfile', label: 'Needs Customer Profile', type: 'checkbox' },
      { name: 'displayOrder', label: 'Display Order', type: 'number' },
      { name: 'isActive', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  statusRemarks: {
    title: 'Quick Remarks',
    api: statusRemarkApi,
    columns: [
      { header: 'Status', path: 'status.status_name' },
      { header: 'Status Code', path: 'status.status_code' },
      { header: 'Remark', path: 'remark_text' },
      { header: 'Ans/Non-Ans', path: 'has_ans_non_ans', type: 'boolean' },
      {
        header: 'Default',
        render: (row) => row.ans_non_ans_default || '-',
      },
      { header: 'Locked', path: 'ans_non_ans_disabled', type: 'boolean' },
      { header: 'Sort', path: 'sort_order' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      {
        name: 'lead_status_id',
        label: 'Lead Status',
        type: 'select',
        required: true,
        loadOptions: loadLeadStatusIdOptions,
      },
      { name: 'remark_text', label: 'Remark Text', required: true },
      { name: 'has_ans_non_ans', label: 'Has Ans/Non-Ans Toggle', type: 'checkbox', defaultValue: true },
      {
        name: 'ans_non_ans_default',
        label: 'Default Response',
        type: 'select',
        options: [
          { value: 'Answered', label: 'Answered' },
          { value: 'Not-Answered', label: 'Not-Answered' },
        ],
      },
      { name: 'ans_non_ans_disabled', label: 'Lock Response Type', type: 'checkbox', defaultValue: false },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },

  motivations: {
    title: 'Motivations',
    api: motivationApi,
    columns: [
      { header: 'Name', path: 'motivation_name' },
      { header: 'Code', path: 'short_code' },
      { header: 'Sort', path: 'sort_order' },
      { header: 'Active', path: 'is_active', type: 'boolean' },
    ],
    fields: [
      { name: 'motivation_name', label: 'Motivation Name', required: true },
      { name: 'short_code', label: 'Short Code' },
      { name: 'color_code', label: 'Color', type: 'color' },
      { name: 'sort_order', label: 'Sort Order', type: 'number' },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
    ],
  },
};
