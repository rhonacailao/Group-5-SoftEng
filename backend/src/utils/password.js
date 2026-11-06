import bcrypt from 'bcryptjs';

// bcrypt only looks at the first 72 bytes of a password, so we refuse anything longer
// instead of silently cutting it.
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_BYTES = 72;

// Higher rounds = slower for attackers (and for us). Tests set BCRYPT_ROUNDS=4 to run fast.
function rounds() {
  return Number(process.env.BCRYPT_ROUNDS) || 12;
}

export function hashPassword(plain) {
  return bcrypt.hash(plain, rounds());
}

// A real hash of a password nobody knows. When the email does not exist we still compare
// against it, so "unknown email" and "wrong password" take the same time to answer.
let dummyHash = null;

export async function verifyPassword(plain, storedHash) {
  if (typeof plain !== 'string' || Buffer.byteLength(plain, 'utf8') > MAX_PASSWORD_BYTES) {
    return false;
  }
  if (!storedHash) {
    dummyHash ??= await bcrypt.hash('not-a-real-password', rounds());
    await bcrypt.compare(plain, dummyHash);
    return false;
  }
  return bcrypt.compare(plain, storedHash);
}

// Returns a message when the password is not acceptable, or null when it is fine.
export function passwordProblem(plain) {
  if (typeof plain !== 'string' || plain.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (Buffer.byteLength(plain, 'utf8') > MAX_PASSWORD_BYTES) {
    return `Use at most ${MAX_PASSWORD_BYTES} bytes (about ${MAX_PASSWORD_BYTES} characters).`;
  }
  return null;
}
