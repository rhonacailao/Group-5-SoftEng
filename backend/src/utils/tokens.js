import crypto from 'node:crypto';

// A random secret that is impossible to guess (64 hex characters).
// Used for login cookies and for the links in set-password / reset-password emails.
export function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

// We store only the SHA-256 hash of a token in the database. If the database ever leaks,
// the stolen hashes cannot be used as links or cookies.
export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
