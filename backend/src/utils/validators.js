import { HttpError } from './httpError.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // something @ something . something

// Each checker returns { value } when the input is fine, or { error } with a message.
// Only real strings are accepted, so {} or [] sent by a hacker never becomes "[object Object]".
export function checkName(raw, label) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return { error: `${label} is required` };
  if (value.length > 50) return { error: `${label} must be 50 characters or fewer` };
  return { value };
}

export function checkEmail(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(value) || value.length > 254) return { error: 'Enter a valid email' };
  return { value };
}

// Turns "12" into 12. Anything else (abc, -1, 1.5) becomes a 404, as if the user did not exist.
export function parseId(raw) {
  if (!/^\d{1,9}$/.test(String(raw))) throw new HttpError(404, 'Not found');
  return Number(raw);
}

// Escapes % and _ so a search for "50%" is not treated as a wildcard
export function escapeLike(text) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

// Turns "2" into 2 and keeps it between min and max. Anything that is not a number gives the fallback.
// Used for ?page= and ?pageSize= on the list endpoints.
export function toInt(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}
