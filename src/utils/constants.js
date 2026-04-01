export const APP_NAME = 'RealEstate CRM';

export const API = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1',
  TIMEOUT_MS: 30000,
};

export const STORAGE_KEYS = {
  ACCESS_TOKEN: process.env.REACT_APP_TOKEN_KEY || 'recrm_access_token',
  REFRESH_TOKEN: process.env.REACT_APP_REFRESH_KEY || 'recrm_refresh_token',
  USER: process.env.REACT_APP_USER_KEY || 'recrm_user',
  THEME: 'recrm_theme',
  SIDEBAR_COLLAPSED: 'recrm_sidebar_collapsed',
};

export const ROLE_CODES = {
  SUPER_ADMIN: 'SA',
  ADMIN: 'ADM',
  SALES_HEAD: 'SH',
  SALES_MANAGER: 'SM',
  TELECALLER: 'TC',
  COLLECTION: 'COL',
  CRM: 'CRM',
};

export const ROLE_GROUPS = {
  ADMIN_LEVEL: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN],
  MANAGEMENT_LEVEL: [ROLE_CODES.SUPER_ADMIN, ROLE_CODES.ADMIN, ROLE_CODES.SALES_HEAD],
  SALES_TEAM: [
    ROLE_CODES.SUPER_ADMIN,
    ROLE_CODES.ADMIN,
    ROLE_CODES.SALES_HEAD,
    ROLE_CODES.SALES_MANAGER,
    ROLE_CODES.TELECALLER,
    ROLE_CODES.CRM,
    ROLE_CODES.COLLECTION,
  ],
};

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  LIMIT_OPTIONS: [10, 20, 50, 100],
};

export const DATE_FORMAT = {
  DISPLAY: 'DD MMM YYYY',
  DATE_TIME: 'DD MMM YYYY, hh:mm A',
  ISO_DATE: 'YYYY-MM-DD',
};
