export const noop = () => {};

export const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

export const safeJsonParse = (value, fallback = null) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const safeJsonStringify = (value, fallback = '') => {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
};

export const debounce = (fn, wait = 250) => {
  let timeoutId;

  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  };
};

export const throttle = (fn, wait = 250) => {
  let waiting = false;
  let pendingArgs = null;

  const run = (...args) => {
    fn(...args);
    waiting = true;

    setTimeout(() => {
      waiting = false;
      if (pendingArgs) {
        const argsToRun = pendingArgs;
        pendingArgs = null;
        run(...argsToRun);
      }
    }, wait);
  };

  return (...args) => {
    if (!waiting) {
      run(...args);
      return;
    }
    pendingArgs = args;
  };
};

export const deepClone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return safeJsonParse(safeJsonStringify(value), value);
};

export const pick = (obj, keys = []) =>
  keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj || {}, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});

export const omit = (obj, keys = []) => {
  const set = new Set(keys);
  return Object.keys(obj || {}).reduce((acc, key) => {
    if (!set.has(key)) acc[key] = obj[key];
    return acc;
  }, {});
};

export const cleanPayload = (payload) => {
  const output = {};
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined) return;
    if (typeof value === 'string') {
      output[key] = value.trim();
      return;
    }
    output[key] = value;
  });
  return output;
};

export const getErrorMessage = (error, fallback = 'Something went wrong') => {
  if (!error) return fallback;
  return (
    error.response?.data?.message ||
    error.response?.data?.error ||
    error.message ||
    fallback
  );
};

export const toTitleCase = (value = '') =>
  String(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getByPath = (obj, path, fallback = undefined) => {
  if (!path) return fallback;
  const result = String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  return result === undefined ? fallback : result;
};
