import { withTransaction } from '../config/db.js';
import * as users from '../repositories/user.repository.js';
import * as sessions from '../repositories/session.repository.js';
import * as tokens from '../repositories/token.repository.js';
import * as audit from '../repositories/audit.repository.js';
import * as credentials from './credential.service.js';
import { canManage, assertCanManage, loadTarget, loadTargetLocked, assertNotLastSuperadmin } from './userAccess.js';
import { HttpError } from '../utils/httpError.js';
import { checkName, checkEmail, escapeLike } from '../utils/validators.js';

const ROLES = ['superadmin', 'admin', 'user'];
const STATUSES = ['Pending', 'Active', 'Inactive', 'Rejected'];

// Tells the screen what it may show for each row (e.g. grey out Edit / Block)
function withCanManage(actor, user) {
  return { ...user, canManage: canManage(actor, user) };
}

function toInt(value, fallback, min, max) {
  const number = Number.parseInt(value, 10);
  if (Number.isNaN(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function duplicateEmail(err) {
  // 23505 = unique index violated, so another user already has this email
  if (err.code === '23505') {
    return new HttpError(409, 'Email already registered', { errors: { email: 'Email already registered' } });
  }
  return err;
}

// S1-DEV-05: the user list (search, filters, paging).
// Admins never see superadmin accounts; the filter runs in SQL, so they are not even fetched.
export async function list(actor, query) {
  const page = toInt(query.page, 1, 1, 1_000_000);
  const pageSize = toInt(query.pageSize, 20, 1, 100);
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';

  const { users: rows, total } = await users.list({
    search: search ? escapeLike(search) : '',
    status: STATUSES.includes(query.status) ? query.status : undefined,
    role: ROLES.includes(query.role) ? query.role : undefined,
    isBlocked: query.blocked === 'true' ? true : query.blocked === 'false' ? false : undefined,
    awaitingApproval: query.awaitingApproval === 'true' ? true : undefined, // S1-DEV-06: the approval queue
    hideRole: actor.role === 'admin' ? 'superadmin' : undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
  return { users: rows.map((user) => withCanManage(actor, user)), total, page, pageSize };
}

export async function get(actor, id) {
  const target = await loadTarget(actor, id);
  return withCanManage(actor, target);
}

// S1-DEV-05: "Add User". The new person is saved as Pending without a password and gets an
// email with a one-time link to choose one; choosing it makes the account Active.
export async function create(actor, body) {
  const errors = {};
  const firstName = checkName(body.firstName, 'First name');
  const lastName = checkName(body.lastName, 'Last name');
  const email = checkEmail(body.email);
  if (firstName.error) errors.firstName = firstName.error;
  if (lastName.error) errors.lastName = lastName.error;
  if (email.error) errors.email = email.error;

  // Admins can only add plain users; a superadmin may also add an admin.
  const role = body.role === undefined ? 'user' : body.role;
  const allowedRoles = actor.role === 'superadmin' ? ['user', 'admin'] : ['user'];
  if (!allowedRoles.includes(role)) {
    errors.role = `Role must be one of: ${allowedRoles.join(', ')}`;
  }
  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, 'Please check the form', { errors });
  }

  let created;
  try {
    created = await withTransaction(actor.email, async (db) => {
      const user = await users.insert(
        { firstName: firstName.value, lastName: lastName.value, email: email.value, role, status: 'Pending', createdBy: actor.email },
        db,
      );
      const token = await credentials.createLink(db, user, 'set_password');
      await audit.write(
        {
          tableName: 'app_user',
          action: 'ADD',
          recordKey: user.id,
          newValues: { email: user.email, role: user.role, status: user.status },
          actor,
        },
        db,
      );
      return { user, token };
    });
  } catch (err) {
    throw duplicateEmail(err);
  }

  // Email only after the transaction is saved, so we never mail a link for a rolled-back user
  const emailSent = await credentials.emailLink(created.user, 'set_password', created.token);
  return { user: withCanManage(actor, created.user), emailSent };
}

// S1-DEV-05: "Edit User". Only name and email can be changed here; role and status have
// their own steps, so nobody can slip them in through this endpoint.
export async function update(actor, id, body) {
  const changes = {};
  const errors = {};
  if (body.firstName !== undefined) {
    const result = checkName(body.firstName, 'First name');
    if (result.error) errors.firstName = result.error;
    else changes.firstName = result.value;
  }
  if (body.lastName !== undefined) {
    const result = checkName(body.lastName, 'Last name');
    if (result.error) errors.lastName = result.error;
    else changes.lastName = result.value;
  }
  if (body.email !== undefined) {
    const result = checkEmail(body.email);
    if (result.error) errors.email = result.error;
    else changes.email = result.value;
  }
  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, 'Please check the form', { errors });
  }
  if (Object.keys(changes).length === 0) {
    throw new HttpError(400, 'Nothing to change. Send firstName, lastName or email.');
  }

  try {
    return await withTransaction(actor.email, async (db) => {
      const { target } = await loadTargetLocked(actor, id, db);
      assertCanManage(actor, target);

      const next = { firstName: target.firstName, lastName: target.lastName, email: target.email, ...changes };
      const updated = await users.updateProfile(id, next, actor.email, db);
      await audit.write(
        {
          tableName: 'app_user',
          action: 'EDIT',
          recordKey: id,
          oldValues: { firstName: target.firstName, lastName: target.lastName, email: target.email },
          newValues: { firstName: updated.firstName, lastName: updated.lastName, email: updated.email },
          actor,
        },
        db,
      );
      return withCanManage(actor, updated);
    });
  } catch (err) {
    throw duplicateEmail(err);
  }
}

// S1-DEV-05: Block / Unblock. Blocking also logs the person out right away.
export async function setBlocked(actor, id, shouldBlock) {
  return withTransaction(actor.email, async (db) => {
    const { target, activeSuperadmins } = await loadTargetLocked(actor, id, db);
    assertCanManage(actor, target);

    // Someone who has not chosen a password yet is already held back by the database
    // (Pending + blocked). Block / Unblock only makes sense after they have a password.
    if (!target.hasPassword) {
      throw new HttpError(409, 'This user has not set a password yet. Use "resend invite" instead.');
    }
    if (shouldBlock) {
      if (target.id === actor.id) throw new HttpError(400, 'You cannot block your own account.');
      assertNotLastSuperadmin(target, activeSuperadmins);
    }
    if (target.isBlocked === shouldBlock) return withCanManage(actor, target); // nothing to do

    const updated = await users.setBlocked(id, shouldBlock, actor.email, db);
    if (shouldBlock) await sessions.removeAllForUser(id, db); // kick them out right now
    await audit.write(
      {
        tableName: 'app_user',
        action: 'EDIT',
        recordKey: id,
        oldValues: { isBlocked: target.isBlocked },
        newValues: { isBlocked: updated.isBlocked },
        actor,
      },
      db,
    );
    return withCanManage(actor, updated);
  });
}

// For a user whose first "set password" link expired. Only for people who were already
// invited or approved: a self-registered user nobody approved yet cannot be let in this way.
export async function resendInvite(actor, id) {
  const result = await withTransaction(actor.email, async (db) => {
    const { target } = await loadTargetLocked(actor, id, db);
    assertCanManage(actor, target);
    if (target.hasPassword) {
      throw new HttpError(409, 'This user already has a password. They can use "Forgot password".');
    }
    if (target.status !== 'Pending' || !(await tokens.anyForUser(id, db))) {
      throw new HttpError(409, 'This user has not been approved or invited yet.');
    }
    const token = await credentials.createLink(db, target, 'set_password');
    return { user: target, token };
  });

  const emailSent = await credentials.emailLink(result.user, 'set_password', result.token);
  return { emailSent };
}

// S1-DEV-06: a superadmin approves someone who registered by themselves. Approving sends
// them the one-time "choose your password" link; choosing it makes the account Active.
// (Until then they stay Pending, because the database only allows a password-less user to be
// Pending and blocked.)
export async function approve(actor, id) {
  const result = await withTransaction(actor.email, async (db) => {
    const { target } = await loadTargetLocked(actor, id, db);
    if (target.hasPassword || target.status !== 'Pending') {
      throw new HttpError(409, 'This user is already active.');
    }
    if (!target.awaitingApproval) {
      throw new HttpError(409, 'This user was already approved. Use "resend invite" if the link expired.');
    }

    const token = await credentials.createLink(db, target, 'set_password');
    await audit.write(
      {
        tableName: 'app_user',
        action: 'EDIT',
        recordKey: id,
        oldValues: { approved: false },
        newValues: { approved: true },
        actor,
      },
      db,
    );
    return { user: await users.findById(id, db), token };
  });

  // Email only after the change is saved
  const emailSent = await credentials.emailLink(result.user, 'set_password', result.token);
  return { user: withCanManage(actor, result.user), emailSent };
}

// S1-DEV-06: designate an admin, or turn an admin back into a plain user. Superadmin accounts
// are never created here (only by the create-superadmin script), but an existing superadmin
// may be stepped down, unless they are the last one.
export async function setRole(actor, id, role) {
  if (role !== 'admin' && role !== 'user') {
    throw new HttpError(400, 'Role must be admin or user', { errors: { role: 'Role must be admin or user' } });
  }

  return withTransaction(actor.email, async (db) => {
    const { target, activeSuperadmins } = await loadTargetLocked(actor, id, db);
    if (target.status !== 'Active' || !target.hasPassword) {
      throw new HttpError(409, 'Only active users can be given a different role.');
    }
    if (target.role === role) return withCanManage(actor, target); // nothing to do

    // Stepping a superadmin down removes one, so the same "last superadmin" rule applies
    assertNotLastSuperadmin(target, activeSuperadmins);

    const updated = await users.setRole(id, role, actor.email, db);
    await audit.write(
      {
        tableName: 'app_user',
        action: 'EDIT',
        recordKey: id,
        oldValues: { role: target.role },
        newValues: { role: updated.role },
        actor,
      },
      db,
    );
    return withCanManage(actor, updated);
  });
}
