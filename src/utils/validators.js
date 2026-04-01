const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{7,15}$/;
const PINCODE_REGEX = /^[0-9]{5,10}$/;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const UPPER_SNAKE_CASE_REGEX = /^[A-Z0-9_]+$/;

export const isRequired = (value) =>
  value !== undefined && value !== null && String(value).trim().length > 0;

export const isEmail = (value) => EMAIL_REGEX.test(String(value || '').trim());

export const isPhone = (value) => PHONE_REGEX.test(String(value || '').trim());

export const isPincode = (value) => PINCODE_REGEX.test(String(value || '').trim());

export const isHexColor = (value) => HEX_COLOR_REGEX.test(String(value || '').trim());

export const isUpperSnakeCase = (value) => UPPER_SNAKE_CASE_REGEX.test(String(value || '').trim());

export const minLength = (value, min) => String(value || '').trim().length >= min;

export const maxLength = (value, max) => String(value || '').trim().length <= max;

export const isNumberInRange = (value, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) => {
  if (value === '' || value === null || value === undefined) return false;
  const num = Number(value);
  return Number.isFinite(num) && num >= min && num <= max;
};

export const validatePassword = (value) => {
  const password = String(value || '');
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must include at least 1 uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must include at least 1 lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must include at least 1 number';
  if (!/[@$!%*?&#^()_+\-=]/.test(password)) return 'Password must include at least 1 special character';
  return null;
};

export const validateConfirmPassword = (password, confirmPassword) => {
  if (password !== confirmPassword) return 'Passwords do not match';
  return null;
};

export const validators = {
  required: (label) => (value) => (isRequired(value) ? null : `${label} is required`),
  email: (value) => (isEmail(value) ? null : 'Invalid email address'),
  phone: (value) => (isPhone(value) ? null : 'Invalid phone number'),
  pincode: (value) => (isPincode(value) ? null : 'Invalid pincode'),
  hexColor: (value) => (isHexColor(value) ? null : 'Color must be in #RRGGBB format'),
  upperSnakeCase: (value) => (isUpperSnakeCase(value) ? null : 'Use UPPER_SNAKE_CASE format'),
  minLen: (min) => (value) => (minLength(value, min) ? null : `Minimum ${min} characters required`),
  maxLen: (max) => (value) => (maxLength(value, max) ? null : `Maximum ${max} characters allowed`),
};

export const validateForm = (values, schema = {}) => {
  const errors = {};

  Object.entries(schema).forEach(([fieldName, fieldValidators]) => {
    const list = Array.isArray(fieldValidators) ? fieldValidators : [fieldValidators];
    for (const rule of list) {
      const error = rule(values[fieldName], values);
      if (error) {
        errors[fieldName] = error;
        break;
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
