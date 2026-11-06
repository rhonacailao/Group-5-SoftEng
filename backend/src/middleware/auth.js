import * as sessions from '../repositories/session.repository.js';
import { hashToken } from '../utils/tokens.js';
import { HttpError } from '../utils/httpError.js';

export const SESSION_COOKIE = 'hope_sid';

// Runs before a protected route. Looks at the cookie, finds the logged-in user in the
// database, and puts them on req.user. Checking the database on EVERY request is what
// makes "Block" work immediately.
// (Express 5 sends anything thrown in an async function to the error handler.)
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const user = token ? await sessions.findUserByTokenHash(hashToken(token)) : null;
  if (!user) throw new HttpError(401, 'Please log in.');

  if (user.isBlocked || user.status !== 'Active') {
    await sessions.removeAllForUser(user.id);
    throw new HttpError(403, 'Your account is blocked. Please contact an administrator.', { code: 'ACCOUNT_BLOCKED' });
  }
  req.user = user;
  next();
}
