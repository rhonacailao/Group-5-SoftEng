import { withTransaction } from '../config/db.js';
import * as users from '../repositories/user.repository.js';
import * as sessions from '../repositories/session.repository.js';
import * as tokens from '../repositories/token.repository.js';
import * as audit from '../repositories/audit.repository.js';
import { HttpError } from '../utils/httpError.js';
import { checkName, checkEmail } from '../utils/validators.js';
import { hashPassword, verifyPassword, passwordProblem } from '../utils/password.js';
import { newToken, hashToken } from '../utils/tokens.js';

export function sessionHours() {
  return Number(process.env.SESSION_HOURS) || 8;
}

// The few fields the browser is allowed to know about the logged-in user
export function toPublicUser(user) {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role };
}

// S1-DEV-02: anyone can register. The server (not the form) decides the role and status,
// so nobody can register themselves as an admin by adding extra fields to the request.
export async function register(body) {
  const errors = {};
  const firstName = checkName(body.firstName, 'First name');
  const lastName = checkName(body.lastName, 'Last name');
  const email = checkEmail(body.email);
  if (firstName.error) errors.firstName = firstName.error;
  if (lastName.error) errors.lastName = lastName.error;
  if (email.error) errors.email = email.error;
  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, 'Please check the form', { errors });
  }

  try {
    await withTransaction(null, async (db) => {
      const user = await users.insert(
        { firstName: firstName.value, lastName: lastName.value, email: email.value, role: 'user', status: 'Pending' },
        db,
      );
      await audit.write(
        {
          tableName: 'app_user',
          action: 'ADD',
          recordKey: user.id,
          newValues: { email: user.email, role: user.role, status: user.status },
          actor: user,
        },
        db,
      );
    });
  } catch (err) {
    // 23505 = the database says this email already exists (unique index)
    if (err.code === '23505') {
      throw new HttpError(409, 'Email already registered', { errors: { email: 'Email already registered' } });
    }
    throw err;
  }
}

// S1-DEV-03: log in. Returns the session token (the controller puts it in a cookie).
export async function login({ email: rawEmail, password }) {
  const email = checkEmail(rawEmail).value;
  const user = email ? await users.findForLogin(email) : null;

  // Always compare, even when the email is unknown, so timing does not reveal who exists
  const passwordOk = await verifyPassword(password, user?.passwordHash);
  if (!user || !passwordOk) {
    throw new HttpError(401, 'Invalid email or password');
  }
  // Only after the password is correct do we say why the account cannot be used
  if (user.isBlocked) {
    throw new HttpError(403, 'Your account is blocked. Please contact an administrator.', { code: 'ACCOUNT_BLOCKED' });
  }
  if (user.status !== 'Active') {
    throw new HttpError(403, 'Your account is waiting for approval.', { code: 'ACCOUNT_PENDING' });
  }

  await sessions.removeExpired();
  const token = newToken();
  await sessions.create({ tokenHash: hashToken(token), userId: user.id, hours: sessionHours() });
  return { token, user: toPublicUser(user) };
}

export async function logout(token) {
  if (token) await sessions.remove(hashToken(token));
}

// S1-DEV-03: the page behind the emailed link: "set your first password".
// (S1-DEV-04 will reuse this same function for "reset a forgotten password".)
export async function setPasswordWithToken({ token, password }) {
  const problem = passwordProblem(password);
  if (problem) throw new HttpError(400, problem, { errors: { password: problem } });

  const looksLikeToken = typeof token === 'string' && /^[0-9a-f]{64}$/.test(token);
  if (!looksLikeToken) throw new HttpError(400, 'This link is not valid.', { code: 'TOKEN_INVALID' });

  return withTransaction(null, async (db) => {
    const link = await tokens.findByHashForUpdate(hashToken(token), db);
    if (!link) throw new HttpError(400, 'This link is not valid.', { code: 'TOKEN_INVALID' });
    if (link.isUsed) {
      throw new HttpError(400, 'This link has already been used. Please request a new one.', { code: 'TOKEN_USED' });
    }
    if (link.isExpired) {
      throw new HttpError(400, 'This link has expired. Please request a new one.', { code: 'TOKEN_EXPIRED' });
    }

    const user = await users.findByIdForUpdate(link.userId, db);
    if (!user || user.status !== 'Active') {
      throw new HttpError(400, 'This link is not valid.', { code: 'TOKEN_INVALID' });
    }
    if (user.isBlocked) {
      throw new HttpError(403, 'Your account is blocked. Please contact an administrator.', { code: 'ACCOUNT_BLOCKED' });
    }

    await users.setPasswordHash(user.id, await hashPassword(password), db);
    await tokens.markUsed(link.id, db);
    await tokens.cancelAllForUser(user.id, db);  // any other open links stop working
    await sessions.removeAllForUser(user.id, db); // log the user out everywhere
    await audit.write(
      {
        tableName: 'app_user',
        action: 'EDIT',
        recordKey: user.id,
        newValues: { event: link.purpose === 'set_password' ? 'password_set' : 'password_reset' },
        actor: user,
      },
      db,
    );
    return { purpose: link.purpose };
  });
}
